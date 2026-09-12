const { z } = require('zod');
const schema = z.object({ a: z.string() }).passthrough();
console.log(schema.parse({ a: "hi", b: "there" }));
