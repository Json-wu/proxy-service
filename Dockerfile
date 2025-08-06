FROM node:22

WORKDIR /usr/src/proxy-service

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 7890

CMD ["npm", "run", "start"]