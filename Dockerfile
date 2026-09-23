# Prebuilt image for the Targetprocess MCP server.
#
# Building this ahead of time (instead of relying on `npx github:...` at MCP
# startup) avoids the on-demand git clone + npm install + tsc build, which is
# far slower than the ~5 second window MCP clients typically allow for a
# freshly started server to answer its first tools/list request.
FROM node:20-alpine

WORKDIR /app

COPY . .

# npm ci triggers the "prepare" script (tsc build) since source is present.
RUN npm ci --omit=optional && npm cache clean --force

ENTRYPOINT ["node", "build/index.js"]
