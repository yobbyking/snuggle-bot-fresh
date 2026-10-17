FROM node:20-slim

# Install yt-dlp, ffmpeg, and Python (for yt-dlp)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    git \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install yt-dlp --break-system-packages

WORKDIR /app

# Copy package files and install
COPY package*.json ./
RUN npm install --omit=dev

# Copy bot files
COPY . .

# Create session directory
RUN mkdir -p session

# Expose port (for health check)
EXPOSE 3000

# Start the bot
CMD ["node", "index.js"]
