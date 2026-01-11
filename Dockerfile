FROM denoland/deno:1.44.0

WORKDIR /app

COPY . .

EXPOSE 8080

RUN deno cache main.ts

CMD ["run", "--allow-all", "--watch", "main.ts"]
