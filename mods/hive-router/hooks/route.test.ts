import { expect, test } from 'claude-code/testing'

import { EMPTY, climb, decide, isWriteCommand, ladderOf, onMiss, onWin, reportsShort, sameTask, tierOfTask, verbOf } from './route'

const base = { prompt: '', fork: false, hasWorkflow: false, isResume: false }

test('explicit models, forks and resumes are left alone', async () => {
  expect(decide({ ...base, subagentType: 'hive-worker', description: 'find files', model: 'opus' }).action).toBe('keep')
  expect(decide({ ...base, subagentType: 'hive-worker', description: 'find files', fork: true }).action).toBe('keep')
  expect(decide({ ...base, subagentType: 'hive-worker', description: 'find files', isResume: true }).action).toBe('keep')
})

test('specialists keep the model their own file names', async () => {
  expect(decide({ ...base, subagentType: 'secrets-auditor', description: 'audit staged changes' })).toMatchObject({
    action: 'keep',
    why: "agent's own model",
  })
})

test('built-in types get their fixed tier', async () => {
  expect(decide({ ...base, subagentType: 'Explore', description: 'map the repo' })).toMatchObject({ action: 'set', step: { tier: 'haiku' } })
  expect(decide({ ...base, subagentType: 'superpowers:code-reviewer', description: 'review' })).toMatchObject({ step: { tier: 'opus' } })
})

test('generalists are routed by the task', async () => {
  expect(tierOfTask('Find all TODO comments', '').tier).toBe('haiku')
  expect(tierOfTask('Summarize the plan', '').tier).toBe('haiku')
  expect(tierOfTask('Design the job retry policy', '').tier).toBe('opus')
  expect(tierOfTask('Scaffold pyproject and CI', 'Set up ruff and pytest.').tier).toBe('sonnet')
  // A heavy word in the brief upgrades; a light verb deep in the brief does not downgrade.
  expect(tierOfTask('Wire the interactions route', 'Verify the Ed25519 signature first.').tier).toBe('opus')
  expect(tierOfTask('Add the heartbeat job', 'Write it, then find and list the tests to run.').tier).toBe('sonnet')
  expect(decide({ ...base, subagentType: 'general-purpose', description: 'list all routes' })).toMatchObject({ step: { tier: 'haiku' } })
})

test('unknown agent types are left alone', async () => {
  expect(decide({ ...base, subagentType: 'someone-else:agent', description: 'design it' }).action).toBe('keep')
})

test('ladders: hive-worker has high-effort rungs, others climb by model only', async () => {
  expect(ladderOf('hive-worker').map(s => `${s.tier}${s.deep ? '+' : ''}`)).toEqual(['haiku', 'haiku+', 'sonnet', 'sonnet+', 'opus', 'opus+'])
  expect(ladderOf('arch-guardian').map(s => s.tier)).toEqual(['haiku', 'sonnet', 'opus'])
  expect(climb('hive-worker', { tier: 'sonnet', deep: false }, 1)).toEqual({ tier: 'sonnet', deep: true })
  expect(climb('hive-worker', { tier: 'sonnet', deep: false }, 9)).toEqual({ tier: 'opus', deep: true })
  expect(climb('arch-guardian', { tier: 'sonnet', deep: false }, 1)).toEqual({ tier: 'opus', deep: false })
})

test('a miss raises the next run of that kind of task; a specialist leaves its own model only when raised', async () => {
  const sig = decide({ ...base, subagentType: 'hive-worker', description: 'Scaffold pyproject and CI' })
  expect(sig).toMatchObject({ action: 'set', step: { tier: 'sonnet', deep: false }, signature: 'hive-worker|standard|scaffold' })
  const raised = decide({ ...base, subagentType: 'hive-worker', description: 'Scaffold the Dockerfile' }, () => onMiss(EMPTY, 1))
  expect(raised).toMatchObject({ action: 'set', step: { tier: 'sonnet', deep: true }, subagentType: 'hive-worker-deep' })
  const auditor = decide({ ...base, subagentType: 'arch-guardian', description: 'check app/' }, () => onMiss(EMPTY, 1))
  expect(auditor).toMatchObject({ action: 'set', step: { tier: 'opus', deep: false } })
  expect(auditor.action === 'set' && auditor.subagentType).toBeFalsy()
})

test('a streak of successes at a raised rung steps one back down', async () => {
  let l = onMiss(EMPTY, 1)
  for (let i = 0; i < 4; i++) l = onWin(l, 2)
  expect(l.bump).toBe(1)
  l = onWin(l, 3)
  expect(l.bump).toBe(0)
  expect(l.streak).toBe(0)
  // At the starting rung, wins just count.
  expect(onWin(EMPTY, 1).bump).toBe(0)
})

test('shell commands that change files are writes', async () => {
  const writes = [
    'echo hi > out.txt',
    'echo hi>out.txt',
    'git diff > patch.diff',
    'cat notes.md >> log.md',
    'make 2> errors.log',
    'npm run build &> build.log',
    'cat > file.ts <<EOF\nexport {}\nEOF',
    "sed -i 's/a/b/' src/x.ts",
    'sed -i.bak s/a/b/ f.txt',
    'sed --in-place s/a/b/ f.txt',
    'make | tee build.log',
    'make | tee -a build.log',
    'cd app && mv a.txt b.txt',
    'cp a.txt b.txt',
    'rm -f tmp.txt',
    'mkdir -p out/deep',
    'touch new.md',
    'python - <<EOF\nprint(1)\nEOF',
    'python3 <<EOF\nprint(1)\nEOF',
    'node - <<EOF\nconsole.log(1)\nEOF',
    `python3 -c "open('x.txt', 'w').write('hi')"`,
    `python -c "from pathlib import Path; Path('x').write_text('y')"`,
    `node -e "require('fs').writeFileSync('x', 'y')"`,
    'git apply fix.patch',
    'git checkout -- src/x.ts',
    'git restore src/x.ts',
    'npx prettier --write src',
    'ruff format .',
    'ruff check --fix .',
    'npx eslint --fix src',
  ]
  expect(writes.filter(c => !isWriteCommand(c))).toEqual([])
})

test('read-only shell commands, and fd copies or /dev/null output, are not writes', async () => {
  const reads = [
    'ls -la',
    'cat file.ts',
    'grep -rn TODO src',
    'git status',
    'git diff',
    'git log --oneline -5',
    'claude plugin test hive-router',
    'claude plugin validate hive-router',
    'npx tsc --noEmit',
    'npm test 2>&1',
    'make 2>&1 | tail -5',
    'ls >/dev/null',
    'ls 2>/dev/null',
    'npm run build &>/dev/null',
    'pytest >&2',
    'git apply --check fix.patch',
    'git restore --staged src/x.ts',
    'ruff format --check .',
    'ruff check .',
    'python -c "print(1)"',
    `python -c "open('x.txt').read()"`,
    'node -e "console.log(1)"',
    'echo "a -> b"',
  ]
  expect(reads.filter(c => isWriteCommand(c))).toEqual([])
})

test('miss signals: PARTIAL reports and re-sent tasks', async () => {
  expect(reportsShort(['RESULT: PARTIAL', 'What I did: ...'].join('\n'))).toBe(true)
  expect(reportsShort(['RESULT: BLOCKED', 'Needs a decision'].join('\n'))).toBe(false)
  expect(reportsShort('RESULT: DONE')).toBe(false)
  expect(sameTask('Scaffold the pyproject', 'scaffold pyproject')).toBe(true)
  expect(sameTask('Scaffold the pyproject', 'Scaffold the Dockerfile')).toBe(false)
  expect(verbOf('Find all the TODOs')).toBe('find')
})
