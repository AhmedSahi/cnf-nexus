# CNF Nexus

## Overview

CNF Nexus is an interactive browser-based simulation of the Wumpus World problem, designed to demonstrate knowledge-based reasoning using propositional logic. The system implements Conjunctive Normal Form (CNF) transformation and resolution refutation to allow an intelligent agent to infer safe and dangerous locations within a grid environment.

The project provides a visual and step-by-step understanding of how logical inference works in artificial intelligence systems.

---

## Features

* Interactive grid-based Wumpus World environment
* Knowledge-based agent with logical reasoning
* CNF-based inference engine
* Resolution refutation for decision making
* Real-time visualization of agent movement
* Percept handling (Breeze and Stench)
* Safe and danger cell inference
* Step-by-step execution and auto-run mode
* Knowledge Base (KB) logging system
* Performance metrics tracking

---

## How It Works

### Environment

* The grid contains:

  * Safe cells
  * Pits (danger)
  * One Wumpus (danger)
* The agent starts from the bottom-left corner.

### Percepts

The agent receives:

* Breeze → indicates nearby pits
* Stench → indicates nearby Wumpus

### Knowledge Base

The agent stores:

* Observations (percepts)
* Logical rules
* CNF clauses

### Inference Mechanism

The system uses:

1. Conversion of logical rules into CNF
2. Resolution refutation to derive new knowledge
3. Deduction of:

   * Safe cells
   * Dangerous cells

From your code:

* `perceiveAndTell()` updates the KB
* `runResolution()` performs inference
* `askSafe_*` and `askDanger_*` evaluate safety

---

## Agent Strategy

The agent follows a priority-based decision model:

1. Move to adjacent safe and unvisited cells
2. Use BFS to reach known safe cells
3. If no safe option exists, take a calculated risk

---

## Project Structure

* `index.html`
  UI structure and layout of the application

* `style.css`
  Styling and visual design

* `agent.js`
  Core logic including:

  * Environment generation
  * Knowledge base management
  * CNF reasoning
  * Resolution inference
  * Agent movement

---

## Controls

* New Episode: Initialize a new environment
* Step Agent: Execute one step of the agent
* Auto-Run: Run the simulation automatically
* Reveal All: Show all hazards

---

## Metrics

The system tracks:

* Inference steps
* Cells visited
* Safe cells inferred
* Knowledge base clauses
* Dangers identified
* CNF resolutions

---

## Educational Purpose

This project demonstrates:

* Propositional logic in AI
* Knowledge representation
* CNF transformation
* Resolution refutation
* Intelligent agent behavior

It is useful for students studying:

* Artificial Intelligence
* Logic and reasoning systems
* Knowledge-based agents

---

## Deployment

This is a frontend-only project.

To run locally:

1. Download or clone the repository
2. Open `index.html` in a browser

To deploy:

* GitHub Pages
* Netlify
* Vercel

---

## Future Improvements

* Visualization of resolution steps
* Multiple agents
* Probabilistic reasoning
* Better heuristics for risk handling

---

## Author

Developed as part of an Artificial Intelligence project focusing on logical inference and intelligent agents.
