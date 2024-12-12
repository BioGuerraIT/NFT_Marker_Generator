FROM node:18-slim

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

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Create required directories
RUN mkdir -p uploads outputs && \
    chmod 777 uploads outputs

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"] 