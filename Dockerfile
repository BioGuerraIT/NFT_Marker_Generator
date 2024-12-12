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
    libpixman-1-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Set build environment variables
ENV PYTHON=/usr/bin/python3
ENV NODE_GYP_FORCE_PYTHON=/usr/bin/python3
ENV NPM_CONFIG_LOGLEVEL=error
ENV NODE_ENV=production
ENV PKG_CONFIG_PATH=/usr/lib/pkgconfig

# Install dependencies
RUN npm install -g node-gyp && \
    npm install -g npm@10.2.4 && \
    npm install --target_platform=linux --target_arch=x64 --production && \
    # Rebuild canvas specifically
    npm rebuild canvas --update-binary && \
    npm cache clean --force

# Copy source code
COPY . .

# Create required directories
RUN mkdir -p uploads outputs && \
    chmod 777 uploads outputs

# Set environment variables
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV LD_LIBRARY_PATH=/usr/local/lib:$LD_LIBRARY_PATH

# Expose port
EXPOSE 3000

# Create a startup script
RUN echo '#!/bin/sh\nnode --expose-gc server.js' > start.sh && \
    chmod +x start.sh

# Start the application with garbage collection enabled
CMD ["./start.sh"]