FROM mcr.microsoft.com/playwright/node:20-noble

WORKDIR /app

# Copy workspace manifests first for layer caching
COPY package*.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/

RUN npm install

COPY . .

# Build the Vite client
RUN npm run build

EXPOSE 3001
ENV NODE_ENV=production
CMD ["node", "server/index.js"]
