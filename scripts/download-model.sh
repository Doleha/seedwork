#!/bin/bash
# scripts/download-model.sh
# Run this ONCE before ./setup.sh on a fresh machine.
# Downloads the qwen3.6:35b-a3b UD-Q4_K_XL GGUF (~20GB) to ./models/.

set -e
MODELS_DIR="./models"
MODEL_FILE="Qwen3.6-35B-A3B-UD-Q4_K_XL.gguf"
HF_REPO="unsloth/Qwen3.6-35B-A3B-MTP-GGUF"

mkdir -p "$MODELS_DIR"

if [ -f "$MODELS_DIR/$MODEL_FILE" ]; then
  echo "Model already downloaded: $MODELS_DIR/$MODEL_FILE"
  exit 0
fi

echo "Downloading $MODEL_FILE (~20GB). This will take a while..."
echo "Do not interrupt this download."

# Use huggingface-cli if available, otherwise wget
if command -v huggingface-cli &> /dev/null; then
  huggingface-cli download "$HF_REPO" "$MODEL_FILE" \
    --local-dir "$MODELS_DIR" \
    --local-dir-use-symlinks False
elif command -v wget &> /dev/null; then
  wget -c \
    "https://huggingface.co/$HF_REPO/resolve/main/$MODEL_FILE" \
    -O "$MODELS_DIR/$MODEL_FILE"
else
  echo "Install huggingface-cli or wget first:"
  echo "  pip install huggingface_hub"
  exit 1
fi

echo "Model downloaded: $MODELS_DIR/$MODEL_FILE"
