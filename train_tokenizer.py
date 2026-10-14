"""
Training script for minbpe tokenizers.
Trains BasicTokenizer and RegexTokenizer on the dataset in tests/taylorswift.txt
and exports the merges to JSON files consumable by the Next.js UI.

Usage:
    python train_tokenizer.py

Output files (written to tokenizer-ui/public/models/):
    basic_tokenizer.json   - BasicTokenizer merges + vocab
    regex_tokenizer.json   - RegexTokenizer merges + vocab
"""

import os
import sys
import json
import time

# Add parent directory to path so we can import minbpe
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from minbpe.basic import BasicTokenizer
from minbpe.regex import RegexTokenizer

DATASET_PATH = os.path.join(os.path.dirname(__file__), "tests", "taylorswift.txt")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "tokenizer-ui", "public", "models")
VOCAB_SIZE = 50255  # target vocabulary size


def load_text(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def tokenizer_to_json(tokenizer, name: str) -> dict:
    """
    Serialize a trained tokenizer to a JSON-friendly dict.
    The JSON format understood by the JS client:
    {
      "name": str,
      "pattern": str,
      "merges": [[p0, p1, idx], ...],   # sorted by idx (merge order)
      "vocab": {str(idx): [byte, ...]}  # idx -> list of byte ints
    }
    """
    # Build sorted merge list
    merges_list = []
    for (p0, p1), idx in tokenizer.merges.items():
        merges_list.append([p0, p1, idx])
    merges_list.sort(key=lambda x: x[2])  # sort by idx

    # Build vocab as {str(idx): list_of_byte_ints}
    vocab_dict = {}
    for idx, bts in tokenizer.vocab.items():
        vocab_dict[str(idx)] = list(bts)

    return {
        "name": name,
        "pattern": getattr(tokenizer, "pattern", ""),
        "vocab_size": len(tokenizer.vocab),
        "merges": merges_list,
        "vocab": vocab_dict,
    }


def train_and_save(tokenizer_class, name: str, text: str, vocab_size: int, **kwargs):
    print(f"\n{'='*60}")
    print(f"Training {name} (vocab_size={vocab_size})...")
    print(f"Text length: {len(text):,} chars")
    print(f"{'='*60}")

    tok = tokenizer_class(**kwargs)
    start = time.time()
    tok.train(text, vocab_size=vocab_size, verbose=False)
    elapsed = time.time() - start
    print(f"  Done in {elapsed:.1f}s. Vocab size: {len(tok.vocab)}")

    data = tokenizer_to_json(tok, name)

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    out_path = os.path.join(OUTPUT_DIR, f"{name.lower().replace(' ', '_')}.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

    size_mb = os.path.getsize(out_path) / 1024 / 1024
    print(f"  Saved to {out_path} ({size_mb:.2f} MB)")
    return tok


def main():
    if not os.path.exists(DATASET_PATH):
        print(f"ERROR: Dataset not found at {DATASET_PATH}")
        print("Please add your training text to tests/taylorswift.txt and re-run.")
        sys.exit(1)

    text = load_text(DATASET_PATH)
    if len(text.strip()) == 0:
        print("ERROR: Dataset file is empty. Please add training text.")
        sys.exit(1)

    print(f"Loaded dataset: {len(text):,} characters")

    # Determine actual vocab size based on dataset size
    # For small datasets, reduce vocab size
    max_possible = 256 + (len(text) // 2)
    actual_vocab_size = min(VOCAB_SIZE, max_possible)
    if actual_vocab_size < VOCAB_SIZE:
        print(f"Note: Dataset too small for {VOCAB_SIZE} vocab. Using {actual_vocab_size}.")

    # Train BasicTokenizer
    train_and_save(BasicTokenizer, "basic_tokenizer", text, actual_vocab_size)

    # Train RegexTokenizer (GPT-4 split pattern)
    train_and_save(RegexTokenizer, "regex_tokenizer", text, actual_vocab_size)

    print("\n✓ All tokenizers trained and saved.")
    print(f"  Output dir: {OUTPUT_DIR}")
    print("\nNext steps:")
    print("  1. cd tokenizer-ui && npm install && npm run dev")
    print("  2. Open http://localhost:3000")


if __name__ == "__main__":
    main()
