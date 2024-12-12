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

# Set build environment variables
ENV PYTHON=/usr/bin/python3
ENV NODE_GYP_FORCE_PYTHON=/usr/bin/python3
ENV NPM_CONFIG_LOGLEVEL=error

# Install dependencies with specific platform
RUN npm install -g npm@latest && \
    npm install --target_platform=linux --target_arch=x64 --no-optional && \
    npm audit fix --force && \
    npm cache clean --force && \
    # Install node-gyp globally
    npm install -g node-gyp && \
    # Rebuild TensorFlow.js with proper flags
    npm rebuild @tensorflow/tfjs-node --build-from-source -- \
    --tensorflow_cpu=1 \
    --tensorflow_mkl=0

# Copy source code
COPY . .

# Create required directories
RUN mkdir -p uploads outputs && \
    chmod 777 uploads outputs

# Set environment variables for TensorFlow.js
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV TF_CPP_MIN_LOG_LEVEL=0
ENV TF_FORCE_GPU_ALLOW_GROWTH=true
ENV LD_LIBRARY_PATH=/usr/local/lib:$LD_LIBRARY_PATH

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]