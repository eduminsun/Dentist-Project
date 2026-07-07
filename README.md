## Virtual Clinical Practice Simulation for Dental Students (2025 Fall)
An interactive simulation program that allows dental students to practice patient encounters in a virtual clinical setting, powered by a large language model.

Clinical communication is difficult to practice safely and repeatedly with real patients. This simulation gives dental students a low-stakes environment to interact with virtual patients presenting a variety of conditions and difficulty levels, structured around the stages of the Calgary–Cambridge Guide (CCG) for clinical communication.

Students move through a realistic consultation — from initiating the session to gathering information, explanation, and closing — while responding to patients whose conditions and behaviors vary from case to case.

Simulation Link: https://dentist-project-six.vercel.app/

## Key Features
- CCG-based consultation flow: patient encounters are organized around the stages of the Calgary–Cambridge Guide
- Variety of cases: patients with different conditions and adjustable difficulty levels
- Scaffolding by design: instructional support is implemented through:
  - toggling the procedure guide page on or off
  - adjusting the difficulty level of the encounter
- LLM-powered patients: patient responses are generated using Gemini 2.5 Flash Lite, enabling natural, open-ended dialogue

## Roadmap
Adaptive scaffolding messages: the next goal is to generate scaffolding feedback dynamically based on each learner's responses, so that support adapts to what the student actually says during the encounter

## Educational Intent
This project explores how scaffolding — a core concept in learning sciences — can be embedded in an LLM-based clinical simulation. Rather than offering a fixed script, the simulation aims to fade or strengthen support (procedure guidance, difficulty, and eventually adaptive feedback) according to the learner's needs, helping students build clinical communication skills progressively.

## Tech Stack
- LLM: Gemini 2.5 Flash Lite

- Deployment: Vercel

## Author
Minsun Cho (minsunrose@naver.com, moon05@snu.ac.kr)

Jiwon Lee (jireh@snu.ac.kr)
