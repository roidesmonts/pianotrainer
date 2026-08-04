function normalizedLogs(counts, smoothing) {
  const total = counts.reduce((sum, count) => sum + count, 0) + smoothing * counts.length
  return counts.map((count) => Math.log((count + smoothing) / total))
}

export function trainHandSeparationModel(sequences, smoothing = 0.1) {
  const initial = { left: Array(128).fill(0), right: Array(128).fill(0) }
  const transitions = {
    left: Array.from({ length: 128 }, () => Array(128).fill(0)),
    right: Array.from({ length: 128 }, () => Array(128).fill(0)),
  }
  const handCounts = { left: 0, right: 0 }

  for (const sequence of sequences) {
    const previousPitch = { left: null, right: null }
    for (const note of sequence) {
      const { hand, midiPitch } = note
      if (hand !== 'left' && hand !== 'right') throw new Error(`Main invalide : ${hand}`)
      if (!Number.isInteger(midiPitch) || midiPitch < 0 || midiPitch > 127) throw new Error(`Hauteur MIDI invalide : ${midiPitch}`)
      handCounts[hand] += 1
      if (previousPitch[hand] === null) initial[hand][midiPitch] += 1
      else transitions[hand][previousPitch[hand]][midiPitch] += 1
      previousPitch[hand] = midiPitch
    }
  }

  const totalHands = handCounts.left + handCounts.right
  return {
    schemaVersion: 2,
    smoothing,
    logHandPrior: {
      left: Math.log(handCounts.left / totalHands),
      right: Math.log(handCounts.right / totalHands),
    },
    logInitialPitch: {
      left: normalizedLogs(initial.left, smoothing),
      right: normalizedLogs(initial.right, smoothing),
    },
    logPitchTransition: {
      left: transitions.left.map((row) => normalizedLogs(row, smoothing)),
      right: transitions.right.map((row) => normalizedLogs(row, smoothing)),
    },
  }
}

function transitionScore(model, hand, previousPitch, pitch) {
  if (previousPitch === null) return model.logInitialPitch[hand][pitch]
  return model.logPitchTransition[hand][previousPitch][pitch]
}

export function scoreHandAssignment(notes, hands, model) {
  const previousPitch = { left: null, right: null }
  return notes.reduce((score, note, index) => {
    const hand = hands[index]
    const next = score + model.logHandPrior[hand] + transitionScore(model, hand, previousPitch[hand], note.midiPitch)
    previousPitch[hand] = note.midiPitch
    return next
  }, 0)
}

export function separateHandsViterbi(notes, model) {
  if (notes.length === 0) return { hands: [], score: 0, exploredStates: 0 }
  let states = new Map([['-1,-1', { score: 0, leftIndex: -1, rightIndex: -1 }]])
  const backpointers = []
  let exploredStates = 0

  for (let index = 0; index < notes.length; index += 1) {
    const nextStates = new Map()
    const pointers = new Map()
    for (const [previousKey, state] of states) {
      for (const hand of ['left', 'right']) {
        const previousIndex = hand === 'left' ? state.leftIndex : state.rightIndex
        const previousPitch = previousIndex < 0 ? null : notes[previousIndex].midiPitch
        const score = state.score + model.logHandPrior[hand] + transitionScore(model, hand, previousPitch, notes[index].midiPitch)
        const leftIndex = hand === 'left' ? index : state.leftIndex
        const rightIndex = hand === 'right' ? index : state.rightIndex
        const key = `${leftIndex},${rightIndex}`
        exploredStates += 1
        if (!nextStates.has(key) || score > nextStates.get(key).score) {
          nextStates.set(key, { score, leftIndex, rightIndex })
          pointers.set(key, { previousKey, hand })
        }
      }
    }
    states = nextStates
    backpointers.push(pointers)
  }

  let bestKey = null
  let bestState = null
  for (const [key, state] of states) {
    if (bestState === null || state.score > bestState.score) { bestKey = key; bestState = state }
  }
  const hands = Array(notes.length)
  for (let index = notes.length - 1; index >= 0; index -= 1) {
    const pointer = backpointers[index].get(bestKey)
    hands[index] = pointer.hand
    bestKey = pointer.previousKey
  }
  return { hands, score: bestState.score, exploredStates }
}

export function findBestPitchCutoff(sequences) {
  let best = { cutoff: 60, errors: Infinity }
  for (let cutoff = 21; cutoff <= 108; cutoff += 1) {
    let errors = 0
    for (const sequence of sequences) for (const note of sequence) {
      if ((note.midiPitch >= cutoff ? 'right' : 'left') !== note.hand) errors += 1
    }
    if (errors < best.errors) best = { cutoff, errors }
  }
  return best
}
