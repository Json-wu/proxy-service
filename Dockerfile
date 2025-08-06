FROM node:22

WORKDIR /usr/src/proxy-service

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3001

CMD ["npm", "run", "start"]