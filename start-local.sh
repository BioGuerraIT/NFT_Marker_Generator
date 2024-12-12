#!/bin/bash

# Set TensorFlow.js environment variables
export TFJS_BACKEND=tensorflow
export TF_FORCE_GPU_ALLOW_GROWTH=true
export TF_CPP_MIN_LOG_LEVEL=0
export TF_ENABLE_ONEDNN_OPTS=0
export NODE_OPTIONS="--max-old-space-size=4096"

# Start the application
npm start 