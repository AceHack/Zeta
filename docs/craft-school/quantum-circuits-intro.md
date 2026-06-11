# Craft school — Craig Gidney's Quirk (the toy quantum layer)

Aaron 2026-06-12: *"Drag-and-drop circuits for Max and Addison: a lesson page in docs/craft-school/ linking Quirk configs that mirror the three jobs (see the entanglement that the fourcorner cartridge draws). No oracle role; play register."*

Welcome to the Quantum Sandbox, Max and Addison!

Before you write code to simulate quantum systems, you can build them by hand. Craig Gidney's **Quirk** is a real-time, drag-and-drop quantum circuit simulator that runs directly in your browser. It shows you the state vector, probabilities, and entanglement as you add gates.

Here are the three circuits representing our three quantum treaty jobs, pre-built for you to play with:

## 1. Singlet CHSH (The Bell Theorem Sandbox)
The CHSH inequality proves that quantum entanglement violates local realism. The maximum possible classical correlation is 2.0; the quantum limit (Tsirelson's bound) is $2\sqrt{2} \approx 2.828$.
We prepare a Singlet state ($|\Psi^-\rangle$) and measure at different analyzer angles:

- **[Play with the Singlet CHSH Circuit in Quirk](https://algassert.com/quirk#circuit=%7B%22cols%22%3A%5B%5B%22H%22%5D%2C%5B%22%E2%80%A2%22%2C%22X%22%5D%2C%5B1%2C%22X%22%5D%2C%5B1%2C%22Z%22%5D%2C%5B%22Ry%22%5D%2C%5B1%2C%22Ry%22%5D%5D%7D)**
  - **WHY it matters**: When you drag the sliders to rotate the measurement axes, you'll see the outcomes coordinate in ways that classical physics literally cannot reproduce.

## 2. Bell Coincidence (Same vs. Opposite Outcomes)
We prepare either a $\Phi^+$ or a Singlet state, rotate the detectors, and measure how often they click together (same outcome) versus opposite:

- **[Play with the Bell Coincidence Circuit in Quirk](https://algassert.com/quirk#circuit=%7B%22cols%22%3A%5B%5B%22H%22%5D%2C%5B%22%E2%80%A2%22%2C%22X%22%5D%2C%5B%22Ry%22%5D%2C%5B1%2C%22Ry%22%5D%5D%7D)**
  - **WHY it matters**: This circuit shows how the coincidence rate is a function of the difference between the angles $\theta = a - b$.

## 3. Mach-Zehnder Interferometer (Wave-Particle Duality)
A single photon enters a beamsplitter (H), acquires a phase shift ($R_z(\phi)$), and passes through a second beamsplitter (H):

- **[Play with the Mach-Zehnder Interferometer in Quirk](https://algassert.com/quirk#circuit=%7B%22cols%22%3A%5B%5B%22H%22%5D%2C%5B%22Rz%22%5D%2C%5B%22H%22%5D%5D%7D)**
  - **WHY it matters**: If you block one arm (or observe it), the interference pattern disappears. Recombining the paths without observation is what makes the final probabilities interfere destructively/constructively.

---

### What to do next:
1. Drag gates (like `X`, `Y`, `Z`, `H`, `Ry`, `Rz`) onto the wires.
2. Watch the **Amplitudes** display showing complex phases and Born probabilities.
3. Try to create your own three-qubit GHZ entanglement state: `[H, I, I]`, then `[•, X, I]`, then `[I, •, X]`.
