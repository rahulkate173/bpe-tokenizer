# minbpe — Minimal BPE Tokenizer

A minimal, educational implementation of **Byte Pair Encoding (BPE)** tokenization in Python, paired with an interactive web visualizer.

## Packages

| Module | Description |
|---|---|
| `minbpe/basic.py` | `BasicTokenizer` — plain byte-level BPE |
| `minbpe/regex.py` | `RegexTokenizer` — BPE with GPT-4 regex splitting |
| `minbpe/gpt4.py`  | `GPT4Tokenizer` — thin wrapper around tiktoken's cl100k_base |

## Web UI

The `tokenizer-ui/` directory contains a **Next.js app** that mirrors the [tiktokenizer](https://tiktokenizer.vercel.app/) UI.
See [`tokenizer-ui/README.md`](./tokenizer-ui/README.md) for full setup and deployment instructions.

## Quick Start

```bash
# Install dependencies
pip install regex tiktoken

# Add training text to tests/taylorswift.txt, then:
python train_tokenizer.py

# Start the web UI
cd tokenizer-ui && npm install && npm run dev
```
