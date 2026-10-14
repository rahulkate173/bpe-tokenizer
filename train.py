"""
train.py — convenience entry point to train minbpe tokenizers.
Simply delegates to train_tokenizer.py.
"""
import subprocess
import sys
import os

if __name__ == "__main__":
    script = os.path.join(os.path.dirname(__file__), "train_tokenizer.py")
    subprocess.run([sys.executable, script] + sys.argv[1:])
