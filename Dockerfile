FROM node:20-bullseye
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
EXPOSE 6880
CMD ["node", "polaris.js"]