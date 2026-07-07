## Virtual Clinical Practice Simulation for Dental Students (2025 Fall)
An interactive simulation program that allows dental students to practice patient encounters in a virtual clinical setting, powered by a large language model.

Clinical communication is difficult to practice safely and repeatedly with real patients. This simulation gives dental students a low-stakes environment to interact with virtual patients presenting a variety of conditions and difficulty levels, structured around the stages of the Calgary–Cambridge Guide (CCG) for clinical communication.

Students move through a realistic consultation — from initiating the session to gathering information, explanation, and closing — while responding to patients whose conditions and behaviors vary from case to case.

https://private-user-images.githubusercontent.com/246391216/520548383-ba0c059f-3cfc-480b-b208-12550b052899.png?jwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3ODMzOTE1NzMsIm5iZiI6MTc4MzM5MTI3MywicGF0aCI6Ii8yNDYzOTEyMTYvNTIwNTQ4MzgzLWJhMGMwNTlmLTNjZmMtNDgwYi1iMjA4LTEyNTUwYjA1Mjg5OS5wbmc_WC1BbXotQWxnb3JpdGhtPUFXUzQtSE1BQy1TSEEyNTYmWC1BbXotQ3JlZGVudGlhbD1BS0lBVkNPRFlMU0E1M1BRSzRaQSUyRjIwMjYwNzA3JTJGdXMtZWFzdC0xJTJGczMlMkZhd3M0X3JlcXVlc3QmWC1BbXotRGF0ZT0yMDI2MDcwN1QwMjI3NTNaJlgtQW16LUV4cGlyZXM9MzAwJlgtQW16LVNpZ25hdHVyZT1lYjY0YzRjNjUzNTFhZmZjYjBjMjdhNjViOTA3N2U5MmE1NGQ4MTVlMzcwN2IxYmNmZDlmZDk0OGY0YTg4M2Q2JlgtQW16LVNpZ25lZEhlYWRlcnM9aG9zdCZyZXNwb25zZS1jb250ZW50LXR5cGU9aW1hZ2UlMkZwbmcifQ.Yu3x_Cby0fk74MJnrKkSzqrFDCoCCtkPNLrMJ4B9SIQ

## Key Features
- CCG-based consultation flow: patient encounters are organized around the stages of the Calgary–Cambridge Guide
- Variety of cases: patients with different conditions and adjustable difficulty levels
- Scaffolding by design: instructional support is implemented through:
>> toggling the procedure guide page on or off
>> adjusting the difficulty level of the encounter
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
