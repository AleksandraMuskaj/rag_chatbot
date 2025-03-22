import * as ort from 'onnxruntime-web/webgpu';
import { env } from '@xenova/transformers';

// WASM-Pfad setzen
ort.env.wasm.wasmPaths = '/dist/';
// Erlaubte Datentypen definieren
type OrtDataTypeKey = 'float16' | 'float32' | 'int32' | 'bool';

export class Phi3SLM {
  sess: ort.InferenceSession | undefined;
  provider = "webgpu";
  profiler = 0;
  verbose = 0;
  dtype: OrtDataTypeKey = 'float16';
  max_tokens = 4000;
  // Feed: Enthält alle Eingabetensoren (z.B. input_ids, attention_mask, past_key_values)
  feed: { [key: string]: any } = {};
  // Ausgabe-Tokens werden als number[] gespeichert
  output_tokens: number[] = [];
  eos = 2;
  need_position_ids = true;
  stop = false;
  kv_dims: number[] = [];
  num_layers = 0;

  // Modellpfade (lokal in Assets)
  phi3_path = "./assets/models/Microsoft/Phi-3-mini-4k-instruct-onnx-web/";
  onnx_model_path = this.phi3_path + "onnx/model_q4f16.onnx";
  onnx_model_external_data_path = this.phi3_path + "onnx/model_q4f16.onnx_data";
  onnx_config_path = this.phi3_path + "config.json";

  constructor() {
    // Konfiguriere Transformers.js-Umgebung
    (env as any).localModelPath = '/assets/models';
    env.allowRemoteModels = true;
    env.allowLocalModels = true;
  }

  // Lädt das ONNX-Modell inkl. externer Daten und initialisiert die Session
  async loadONNX() {
    const opt: ort.InferenceSession.SessionOptions = {
      executionProviders: [this.provider],
      preferredOutputLocation: {},
    };

    // Modellkonfiguration laden
    const configResponse = await fetch(this.onnx_config_path);
    const model_config = await configResponse.json();

    // ONNX-Modell und externe Daten laden
    const modelBytes = await fetch(this.onnx_model_path).then(res => res.arrayBuffer());
    const externalData = await fetch(this.onnx_model_external_data_path).then(res => res.arrayBuffer());

    // Bevorzugte Speicherorte für jeden Layer setzen
    for (let i = 0; i < model_config.num_hidden_layers; ++i) {
      (opt.preferredOutputLocation as { [key: string]: string })[`present.${i}.key`] = 'gpu-buffer';
      (opt.preferredOutputLocation as { [key: string]: string })[`present.${i}.value`] = 'gpu-buffer';
    }

    opt.externalData = [{
      data: externalData,
      path: 'model_q4f16.onnx_data',
    }];

    ort.env.webgpu.profiling = {};

    // Session erstellen – Non-Null Assertion, da wir wissen, dass die Session initialisiert wird.
    this.sess = await ort.InferenceSession.create(modelBytes, opt);
    this.eos = model_config.eos_token_id;
    // Prüfe, ob der dritte Wert in kv_dims (momentan 0) korrekt ist – ggf. anpassen
    this.kv_dims = [1, model_config.num_key_value_heads, 0, model_config.hidden_size / model_config.num_attention_heads];
    this.dtype = "float16";
    this.num_layers = model_config.num_hidden_layers;
    this.initilize_feed();
  }

  // Generiert Tokens basierend auf den Eingabetokens (Streaming über Callback)
  async generate(tokens: number[], callback: (tokens: number[]) => void, options: { max_tokens?: number }): Promise<number[]> {
    const max_tokens = options.max_tokens || 256;
    const feed = this.feed;
    // Konvertiere Tokens in einen BigInt64Array-Tensor
    const input_ids = new ort.Tensor('int64', BigInt64Array.from(tokens.map(t => BigInt(t))), [1, tokens.length]);
    feed['input_ids'] = input_ids;
    this.stop = false;
    // Hier wird der BigInt-Wert in number konvertiert, um output_tokens als number[] zu halten
    this.output_tokens.push(...(input_ids.data as unknown as number[]));
    let last_token = 0n;
    let seqlen = this.output_tokens.length;
    const input_len = input_ids.size;

    if (this.need_position_ids) {
      feed['position_ids'] = new ort.Tensor(
        'int64',
        BigInt64Array.from({ length: input_len }, (_, i) => BigInt(seqlen - input_len + i)),
        [1, input_len]
      );
    }

    while (!this.stop && seqlen < max_tokens && Number(last_token) != 32007 && Number(last_token) != 32000 ) {
      seqlen = this.output_tokens.length;

      feed['attention_mask'] = new ort.Tensor(
        'int64',
        BigInt64Array.from({ length: seqlen }, () => 1n),
        [1, seqlen]
      );
      // Verwende Non-Null Assertion, da sess initialisiert sein muss
      const outputs = await this.sess!.run(feed);
      // Errechne das nächste Token und konvertiere von BigInt in number
      last_token = BigInt(this.argmax(outputs['logits']));
      // Wenn das EOS-Token generiert wurde, füge es hinzu und beende die Schleife
      if (last_token === BigInt(this.eos)) {
        this.output_tokens.push(Number(last_token));
        break;
      }
      this.output_tokens.push(Number(last_token));
      if (callback && !this.profiler) {
        callback(this.output_tokens);
      }
      this.update_kv_cache(feed, outputs);
      feed['input_ids'] = new ort.Tensor('int64', BigInt64Array.from([last_token]), [1, 1]);
      if (this.need_position_ids) {
        feed['position_ids'] = new ort.Tensor('int64', BigInt64Array.from([BigInt(seqlen)]), [1, 1]);
      }
    }
    if (this.profiler) {
      this.sess!.endProfiling();
    }
    return this.output_tokens;
  }

  // Initialisiert den Feed (Key-Value-Cache) für das Modell
  initilize_feed() {
    // Vorherige GPU-Buffer entsorgen
    for (const name in this.feed) {
      const t = this.feed[name];
      if (t.location === 'gpu-buffer') {
        t.dispose();
      }
    }
    this.feed = {};
    const empty = (this.dtype === "float16") ? new Uint16Array() : [];
    for (let i = 0; i < this.num_layers; ++i) {
      this.feed[`past_key_values.${i}.key`] = new ort.Tensor(this.dtype, empty, this.kv_dims);
      this.feed[`past_key_values.${i}.value`] = new ort.Tensor(this.dtype, empty, this.kv_dims);
    }
    this.output_tokens = [];
  }

  // Führt eine einfache argmax-Berechnung auf dem Tensor durch
  argmax(t: ort.Tensor): number {
    const arr = t.data as Float32Array;
    const start = t.dims[2] * (t.dims[1] - 1);
    let max = arr[start];
    let maxidx = 0;
    for (let i = 0; i < t.dims[2]; i++) {
      const val = arr[i + start];
      if (!isFinite(val)) {
        throw new Error("Found non-finite value in logits");
      }
      if (val > max) {
        max = val;
        maxidx = i;
      }
    }
    return maxidx;
  }

  // Aktualisiert den Key-Value-Cache basierend auf den Outputs
  update_kv_cache(feed: { [key: string]: any }, outputs: { [key: string]: any }) {
    for (const name in outputs) {
      if (name.startsWith('present')) {
        const newName = name.replace('present', 'past_key_values');
        const t = feed[newName];
        if (t && t.location === 'gpu-buffer') {
          t.dispose();
        }
        feed[newName] = outputs[name];
      }
    }
  }

  // Stoppt die Generierung
  abort() {
    this.stop = true;
  }
}
