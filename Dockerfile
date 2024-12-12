FROM node:18

# Install dependencies for canvas and TensorFlow.js
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    pkg-config \
    python3 \
    python3-pip \
    libatlas-base-dev \
    libhdf5-dev \
    libhdf5-serial-dev \
    libstdc++6 \
    gfortran \
    libblas-dev \
    liblapack-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with specific platform and clean npm cache
RUN npm install --target_platform=linux --target_arch=x64 && \
    npm cache clean --force && \
    # Rebuild TensorFlow.js for the current platform
    npm rebuild @tensorflow/tfjs-node --build-from-source

# Copy source code
COPY . .

# Create required directories
RUN mkdir -p uploads outputs && \
    chmod 777 uploads outputs

# Set environment variables for TensorFlow.js
ENV TFJS_BACKEND=tensorflow
ENV TF_FORCE_GPU_ALLOW_GROWTH=true
ENV TF_CPP_MIN_LOG_LEVEL=0
ENV TF_ENABLE_ONEDNN_OPTS=0
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV LD_LIBRARY_PATH=/usr/local/lib:$LD_LIBRARY_PATH

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]