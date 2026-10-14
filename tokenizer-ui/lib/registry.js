/**
 * Registry of available tokenizers.
 * Each entry describes a tokenizer the UI can load.
 *
 * Fields:
 *  id        - unique key
 *  label     - display name in the dropdown
 *  group     - section header in the dropdown
 *  type      - "basic" | "regex" | "gpt4"
 *  modelPath - path under /public/models/ (null for gpt4)
 *  description
 */

export const TOKENIZER_REGISTRY = [
  {
    id: "basic_tokenizer",
    label: "BasicTokenizer (minbpe)",
    group: "minbpe — Custom Trained",
    type: "basic",
    modelPath: "/models/basic_tokenizer.json",
    description:
      "Byte-level BPE without regex splitting. Trained on the Taylor Swift corpus.",
  },
  {
    id: "regex_tokenizer",
    label: "RegexTokenizer (minbpe)",
    group: "minbpe — Custom Trained",
    type: "regex",
    modelPath: "/models/regex_tokenizer.json",
    description:
      "Byte-level BPE with GPT-4 regex split pattern. Trained on the Taylor Swift corpus.",
  },
  {
    id: "gpt4",
    label: "GPT-4 (cl100k_base)",
    group: "OpenAI",
    type: "gpt4",
    modelPath: null,
    description:
      "The cl100k_base tokenizer used by GPT-4, GPT-3.5-turbo, and text-embedding models.",
  },
  {
    id: "gpt2",
    label: "GPT-2 (r50k_base)",
    group: "OpenAI",
    type: "gpt4",  // reuse the API route, pass model param
    modelPath: null,
    apiModel: "gpt2",
    description:
      "The r50k_base tokenizer used by GPT-2 and early GPT-3 models.",
  },
];

export const TOKENIZER_GROUPS = [
  ...new Set(TOKENIZER_REGISTRY.map((t) => t.group)),
];

export function getTokenizerById(id) {
  return TOKENIZER_REGISTRY.find((t) => t.id === id) || TOKENIZER_REGISTRY[0];
}
