# BPE Tokenizer — Build and Documentation

Last updated: 2026-10-15

This document explains the goals and internals of the bpe-tokenizer project, how Byte Pair Encoding (BPE) is used here, what “min BP” refers to in this repository, how the tokenizer is built, the tokenizer UI, supported text types, configuration, example usage, and maintenance notes.

Table of contents
- Project overview
- What is BPE (Byte Pair Encoding)?
- What “min BP” means in this project
- How we build the tokenizer
  - Data preparation
  - BPE training (merging procedure)
  - Vocabulary and merges file
  - Tokenizer runtime (encoding/decoding)
- Tokenizer UI (tokenizer.ui)
  - Purpose and features
  - File structure and how to run it
  - UX notes
- Text type(s) supported
- Configuration and parameters
  - Important runtime/build flags (including min_bp)
- Examples (training, encoding, decoding)
- Implementation notes and file map
- Tests and validation
- License & contribution notes

---

Project overview

This repository implements a BPE-based tokenizer and a simple UI for inspecting and experimenting with tokenization behavior. The goals are:
- Provide a reproducible implementation of BPE training and tokenization.
- Produce a stable vocabulary and merges list that can be used for fast encoding/decoding.
- Give a small interactive UI for testing how input text is split and how merges are applied.

This document is the canonical reference for how the tokenizer is built, how to run the UI, and the main concepts.

---

What is BPE (Byte Pair Encoding)?

Byte Pair Encoding (BPE) is a data-driven subword segmentation algorithm commonly used to build tokenizers for NLP models. The algorithm starts with a symbol vocabulary (commonly single bytes or characters). It repeatedly finds the most frequent adjacent symbol pair in the training text and merges that pair into a new symbol. Each merge reduces the total number of symbol occurrences and increases vocabulary expressiveness.

Key points:
- BPE is greedy and frequency-driven: the highest-frequency adjacent pair is merged at each step.
- After N merges, you end up with a vocabulary consisting of initial symbols plus N merged tokens.
- BPE is deterministic given the same training data, preprocessing, and tie-breaking rules.

Advantages:
- Produces subword units that balance vocabulary size and expressiveness.
- Efficient to encode/decode and widely used in production tokenizers.

---

What “min BP” means in this project

In this repository, the term “min BP” refers to the minimum pair frequency threshold used during BPE training to decide whether a candidate pair is worth merging. It is short for “minimum byte-pair frequency” (min_bp).

Why a min_bp matters:
- Pure BPE will perform a fixed number of merges (or until no pairs remain). In practice, very-low-frequency merges can produce noisy or overly specific tokens that harm generalization.
- Setting a min_bp > 1 prevents merging pairs that occur fewer than min_bp times in the training corpus. This reduces vocabulary bloat and prevents creating tokens supported only by extremely rare contexts.

How it’s used in this project:
- During training, after counting pair frequencies, a candidate pair is considered for merging only if its frequency >= min_bp. If no pairs meet min_bp, training stops early even if the target number of merges hasn't been reached.
- Default value (recommended): min_bp = 2. This is conservative and stops merges that occur once. The project configuration exposes this parameter so you can experiment.

Note: If you prefer a pure fixed-merge BPE (common for large corpora), set min_bp = 1 and provide a merge count target. If you prefer frequency-based stopping, set merges to a large upper bound and rely on min_bp to stop training.

---

How we build the tokenizer

The build pipeline has four main phases: data preparation, counting, merging (training), and preparing runtime artifacts (vocabulary + merges). The project includes scripts (JavaScript / Python) to execute each step reproducibly.

1) Data preparation
- Normalize line endings and optionally lowercase text (configurable).
- Optionally apply Unicode normalization (NFC) and strip control characters.
- Add a special end-of-word marker (commonly a whitespace delimiter) if desired; the implementation here uses whitespace tokenization as a preprocessing step so that spaces remain informative.
- Aggregate training text into a single corpus file for counting.

2) Counting symbols and pairs
- Initialize symbol sequences: each word is represented as a sequence of characters (or bytes) with a special end-of-word marker (optional).
- Count occurrences of all adjacent symbol pairs across the corpus.
- Maintain two counts: symbol frequencies and pair frequencies.

3) BPE training (merging procedure)
- Repeat while merges < max_merges and top_pair_freq >= min_bp:
  - Find the pair with highest frequency (ties broken deterministically, e.g., lexicographic order).
  - Add the pair to the merges list.
  - Replace occurrences of that pair in the corpus with the merged token (update symbol and pair counts incrementally for efficiency).
- Output a merges file (ordered list of merge operations) and a vocabulary file (final tokens and counts).

Implementation notes:
- The training implementation is incremental and optimized for moderate corpora (typical repository scripts use Python for training; JS runtime uses precomputed files for encoding).
- To handle large corpora, offload counting to streaming passes and use efficient data structures (hash maps) for counts.

4) Runtime: encoding & decoding
- Encoding takes an input string, applies the same normalization, splits into words, and for each word applies the merges sequentially according to the merges list. The typical approach is:
  - Start with characters as tokens.
  - For each merge in the merges list, replace occurrences of that pair in the token sequence.
  - Continue until no more merges apply for that word.
- Use the vocabulary map to map tokens to token IDs.
- Decoding maps token IDs back to subword tokens and reconstructs words by concatenation (replacing end-of-word markers appropriately).

Performance notes:
- A runtime implementation caches merge lookups in a dictionary for faster operations.
- Practical implementations apply greedy pair-finding per word rather than rescanning the entire corpus.

---

Tokenizer UI (tokenizer.ui)

Purpose and features
- The tokenizer UI is a small interactive tool to visualize how input text is split into subwords and how merges were applied.
- Typical features:
  - Input text box to type/paste sample text.
  - Live display of tokens and their token IDs.
  - Option to show merge steps (step-through merges applied to a highlighted word).
  - Toggle configuration (min_bp, merges limit, lowercase, normalization).
  - Export the tokenization result as JSON or copy token IDs to clipboard.

File structure and how to run it
- The UI is implemented using the JavaScript part of the repo and served as a static page (index.html) or a small dev server. Typical files:
  - tokenizer.ui/index.html — main UI shell
  - tokenizer.ui/main.js — UI logic and calls to the tokenizer runtime
  - tokenizer.ui/styles.css — UI styles
  - tokenizer.ui/data/ — prebuilt vocabulary.json and merges.txt loaded for the UI demo

How to run locally (example)
1. Install dependencies (if any): npm install
2. Start a static server (or npm run dev): npx http-server tokenizer.ui
3. Open http://localhost:8080 (or the port used) and interact with the UI.

UX notes
- The UI is for demonstration and debugging — not intended as a production encoding API.
- It visualizes step-by-step merges so you can diagnose where merges may be creating undesired tokens.

---

Text type(s) supported

This project is focused on natural-language text. Specifically:
- Plain UTF-8 text (any language), with optional Unicode normalization.
- Tokenization operates at the character/subword level; languages without whitespace separators will still be supported but may require different preprocessing.
- The system assumes script-level segmentation is not performed (e.g., for Chinese/Japanese you may want to include additional preprocessing to split into characters or morphemes depending on your goals).

Special tokens
- The vocabulary supports special tokens such as <unk>, <pad>, <s>, </s> where required; include them at the top of the vocabulary if you need model compatibility.

---

Configuration and parameters

Key build and runtime parameters you can tune:
- max_merges (integer): maximum number of merges to perform during training. Typical values range from a few thousand to 50k+ depending on target vocab size.
- min_bp (integer): minimum pair frequency threshold to allow a merge (default recommended: 2). When set to 1, BPE will consider even pairs that occur only once.
- lowercase (bool): whether to lowercase input before training/encoding.
- unicode_normalization (string|null): e.g., "NFC" or "NFKC" or null.
- end_of_word_marker (string|null): symbol appended to words to preserve suffix information (common choices: "</w>" or a special space marker). If used, it must be applied consistently in training and runtime.

Where to set these
- The repo exposes configuration via a JSON or YAML config in the project root (config.json), or via CLI flags on training scripts.
- Example CLI (Python script): python train_bpe.py --corpus corpus.txt --max-merges 10000 --min-bp 2 --lowercase

Recommended defaults
- max_merges: 10000 (for small experiments) or 30000+ for larger coverage
- min_bp: 2 (safer default)

---

Examples

Train a tokenizer (example CLI)

1) Prepare corpus
- Place training text into corpus.txt, one sentence or document per line.

2) Train (example)

python train_bpe.py --corpus corpus.txt --max-merges 20000 --min-bp 2 --out-vocab vocab.json --out-merges merges.txt

This produces:
- vocab.json — map token -> id (and optionally counts)
- merges.txt — newline-separated pair merges in the order they were learned

Encode text (example)

# Using the JS runtime
node encode.js "This is a test."
# Output: token IDs or token pieces and IDs

Decode (example)
node decode.js 512,120,15
# Output: reconstructed string

Using the UI
- Start the dev server for tokenizer.ui and paste text into the input; use toggles to enable showing merges.

---

Implementation notes and file map

Key files (typical layout)
- train_bpe.py (or scripts/train.js) — training script, produces merges.txt and vocab.json
- tokenizer/encoder.js — runtime encoder implementation used by UI and CLI
- tokenizer/decoder.js — runtime decoder implementation
- tokenizer/vocab.json — prebuilt vocabulary shipped for demos
- tokenizer/merges.txt — prebuilt merges shipped for demos
- tokenizer.ui/ — UI files (index.html, main.js, styles.css)
- examples/ — sample corpora and usage examples

Where min_bp lives
- The training script reads min_bp from CLI flag or config file. Search the repo for "min_bp" or "min-bp" configuration keys if you want to locate the exact default.

---

Tests and validation

- Unit tests should cover:
  - Pair counting & frequency calculation
  - Deterministic merge ordering and tie breaking
  - Encoding/decoding round-trip tests (encode -> decode == original, modulo normalization)
  - UI tokenization correctness for a representative set of inputs

- Validation steps:
  - Train on a held-out corpus and inspect that uncommon merges are not present when min_bp > 1.
  - Use sample sentences to check tokenization coverage and vocabulary growth.

---

Maintenance notes

- Keep merges.txt and vocab.json consistent: merges order must match the vocabulary construction used at runtime.
- If you change preprocessing (lowercasing, normalization, end-of-word markers), retrain the tokenizer and update UI data files.
- For reproducibility, check in the exact training command and random seeds (if any) used to produce shipped artifacts.

---

FAQ

Q: Should I set min_bp to 1 or 2?
A: Set min_bp = 2 to avoid one-off merges that create brittle tokens. Use min_bp = 1 only when you explicitly want a fixed number of merges irrespective of pair frequency.

Q: Why do I sometimes see tokens that look like fragments of words?
A: BPE can create subword tokens that are fragments — this is the intended behavior: frequent fragments become tokens which helps represent rare words by composition.

Q: How do I add custom special tokens?
A: Add them to vocab.json at the top with reserved IDs and ensure they are not generated during training; most training pipelines accept a reserved_tokens list.

---

Contact and contribution

If you want to contribute fixes or improvements, open an issue or a pull request. Document any change to default configuration in this file so users can reproduce artifacts.

---

Appendix: Recommended quick commands

Train (Python example)
python train_bpe.py --corpus corpus.txt --max-merges 20000 --min-bp 2 --out-vocab tokenizer/vocab.json --out-merges tokenizer/merges.txt

Run UI (static serve)
npx http-server tokenizer.ui -p 8080

Encode from Node (example)
node tokenizer/encode.js --merges tokenizer/merges.txt --vocab tokenizer/vocab.json --text "Hello world"

---

If you want, I can:
- Inspect the repository and set the exact default min_bp value from your training script, then update this document with exact flags and file paths.
- Create a small example corpus and a prebuilt vocab+merges for the demo UI.

