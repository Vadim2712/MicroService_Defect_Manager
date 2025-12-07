FROM node:18-alpine

WORKDIR /app

COPY api_gateway/package*.json ./
RUN npm install

COPY api_gateway/. .

# Copy the docs directory
COPY docs ./docs

EXPOSE 8000

CMD ["npm", "start"]