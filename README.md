# [Runcrate](https://runcrate.ai) TypeScript SDK

Official TypeScript/JavaScript SDK for the [Runcrate](https://runcrate.ai) platform. Manage GPU instances and run model inference.

- Zero runtime dependencies — native `fetch`
- ESM + CJS dual output
- Full TypeScript types
- Auto-retry with exponential backoff

## Installation

```bash
npm install @runcrate/sdk
```

## Quick Start

```typescript
import Runcrate from '@runcrate/sdk';

const rc = new Runcrate({ apiKey: 'rc_live_...' });

// List GPU instances
const instances = await rc.instances.list();

// Create an instance
const instance = await rc.instances.create({
  name: 'training-run',
  sshKeyId: 'key_abc123',
  gpuType: 'A100',
  gpuCount: 1,
});

// Check balance
const balance = await rc.billing.getBalance();
console.log(`Credits: $${balance.creditsBalance}`);
```

You can also set the `RUNCRATE_API_KEY` environment variable instead of passing `apiKey`.

## Model Inference

All inference methods hit `api.runcrate.ai`.

### Chat Completions

```typescript
const completion = await rc.models.chatCompletion({
  model: 'deepseek-ai/DeepSeek-V3',
  messages: [{ role: 'user', content: 'Hello!' }],
});
console.log(completion.choices[0].message.content);
```

### Streaming

```typescript
const stream = await rc.models.chatCompletion({
  model: 'deepseek-ai/DeepSeek-V3',
  messages: [{ role: 'user', content: 'Tell me a story' }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices?.[0]?.delta?.content ?? '');
}
```

### Image Generation

```typescript
const image = await rc.models.generateImage({
  model: 'black-forest-labs/FLUX.1-schnell',
  prompt: 'A futuristic cityscape at sunset',
  width: 1024,
  height: 768,
});
console.log(image.data[0].url);
```

### Video Generation

```typescript
// Submit and poll until complete, then save to disk
const job = await rc.models.generateVideoAndSave('output.mp4', {
  model: 'google/veo-3.0',
  prompt: 'A drone flying over mountains',
  duration: 8,
  onStatus: (j) => console.log(`Status: ${j.status}`),
});
```

### Text-to-Speech

```typescript
import { writeFile } from 'node:fs/promises';

const audio = await rc.models.textToSpeech({
  model: 'openai/tts-1',
  input: 'Hello from Runcrate!',
  voice: 'alloy',
});
await writeFile('speech.mp3', Buffer.from(audio));
```

### Transcription

```typescript
import { readFile } from 'node:fs/promises';

const audioFile = await readFile('recording.wav');
const result = await rc.models.transcribe({
  model: 'openai/whisper-1',
  file: audioFile,
  filename: 'recording.wav',
});
console.log(result.text);
```

## Infrastructure Management

### Instances

```typescript
const instances = await rc.instances.list();
const instance = await rc.instances.get('instance-id');
const status = await rc.instances.getStatus('instance-id');
await rc.instances.terminate('instance-id');

// Browse available GPU types
const types = await rc.instances.listTypes({ gpuType: 'A100' });
```

#### Auto-stop for unattended work

When an agent or script launches an instance, give it limits so it stops on its own:

```typescript
const instance = await rc.instances.create({
  name: 'agent-job',
  sshKeyId: 'key_abc123',
  gpuType: 'A100',
  maxRuntimeMinutes: 240,   // terminate 4 hours after it starts running (5 to 10080)
  idleShutdownMinutes: 30,  // terminate after 30 idle minutes (5 to 1440)
});

const current = await rc.instances.get(instance.id);
console.log(current.autoStopAt);  // ISO time the max runtime stops it, or null
console.log(current.stopReason);  // 'max_runtime', 'idle', 'budget', ... or null
```

- `maxRuntimeMinutes`: the clock starts when the instance first becomes running, and an alert goes out 10 minutes before it stops.
- `idleShutdownMinutes`: idle means GPU utilisation under 5% with nobody connected (SSH, web terminal or editor); GPU instances only.
- Omit either one, or pass `null`, for no limit. Values outside the ranges throw a `BadRequestError`.

### SSH Keys

```typescript
const keys = await rc.sshKeys.list();
const key = await rc.sshKeys.create({
  name: 'my-laptop',
  publicKey: 'ssh-ed25519 AAAA...',
});
await rc.sshKeys.delete('key-id');
```

### Storage

```typescript
const volumes = await rc.storage.list();
const volume = await rc.storage.get('volume-id');
```

### Environments

```typescript
const environments = await rc.environments.list();
const env = await rc.environments.create({ name: 'staging' });
await rc.environments.update('env-id', { name: 'production' });
await rc.environments.delete('env-id');

// Monthly budget, read-only (null means no cap)
const { monthlyBudgetUsd, monthToDateUsd, budgetRemainingUsd } = await rc.environments.get('env-id');
```

A workspace owner or admin sets an environment's monthly budget in the dashboard, under Workspace settings. The API and this SDK can read it but never set it. At 100% of the budget, launches in that environment fail, running instances stop and inference calls with that environment's API keys are refused until the month ends or the budget is raised.

### Templates

```typescript
const templates = await rc.templates.list({
  search: 'pytorch',
  category: 'ml',
  page: 1,
  pageSize: 10,
});
console.log(`Found ${templates.total} templates`);
```

### Billing

```typescript
const balance = await rc.billing.getBalance();
const txns = await rc.billing.listTransactions({ limit: 20 });
const usage = await rc.billing.usage({ from: '2025-01-01', to: '2025-01-31' });
```

## Error Handling

```typescript
import {
  NotFoundError,
  RateLimitError,
  AuthenticationError,
  InsufficientCreditsError,
} from '@runcrate/sdk';

try {
  await rc.instances.get('nonexistent');
} catch (err) {
  if (err instanceof NotFoundError) {
    console.log('Instance not found');
  } else if (err instanceof RateLimitError) {
    console.log('Rate limited, retry later');
  } else if (err instanceof AuthenticationError) {
    console.log('Invalid API key');
  }
}

try {
  await rc.instances.create({ name: 'agent-job', sshKeyId: 'key_abc123', gpuType: 'A100' });
} catch (err) {
  if (err instanceof InsufficientCreditsError && err.code === 'BUDGET_REACHED') {
    console.log(err.message); // the environment's monthly budget is used up
  } else if (err instanceof InsufficientCreditsError) {
    console.log('Add credits to keep launching');
  }
}
```

Every API error carries `statusCode`, `code` and `message`. A 402 has `code` `insufficient_credits` when the balance is too low, `BUDGET_REACHED` when a launch hits an environment's monthly budget, and `budget_exceeded` when an inference call hits it.

## Configuration

```typescript
const rc = new Runcrate({
  apiKey: 'rc_live_...',        // or RUNCRATE_API_KEY env var
  baseUrl: 'https://runcrate.ai',      // infrastructure API
  inferenceUrl: 'https://api.runcrate.ai', // model inference API
  timeout: 30,                  // seconds
  maxRetries: 3,                // retry on 429/5xx
  customHeaders: {},            // extra headers
});
```

## Requirements

- Node.js >= 18 (for native `fetch`)
- TypeScript >= 5.0 (optional, for type checking)

