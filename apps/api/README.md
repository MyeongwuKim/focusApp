# API (Fastify + Apollo + Prisma + MongoDB)

## Start

```bash
cp .env.example .env
pnpm install
pnpm api:prisma:generate
pnpm api:dev
```

## Endpoints

- GraphQL: `http://localhost:4000/graphql`
- Health: `http://localhost:4000/healthz`

## Example GraphQL

```graphql
query Health {
  health
}
```

```graphql
mutation CreateUser {
  createUser(input: { email: "hello@example.com", name: "hello" }) {
    id
    email
    name
  }
}
```

```graphql
query Me {
  me {
    id
    email
    name
  }
}
```

`me` query uses `Authorization: Bearer <userId>` as demo auth header.
