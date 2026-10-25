// Fallback interviewer questions used when no AI provider is configured.
// Placeholders: {name} {role} {skill} {skill2} {project} {tech}

export const TOPIC_QUESTIONS = {
  "React": [
    "How does React decide what to re-render, and when would you reach for useMemo or useCallback?",
    "Explain the difference between controlled and uncontrolled components, and when you'd pick each."
  ],
  "Next.js": ["When would you choose server-side rendering over static generation in Next.js, and why?"],
  "Node.js": [
    "Explain the Node.js event loop. What happens if you run a CPU-heavy task on the main thread?",
    "How would you handle errors consistently across an Express API?"
  ],
  "Express": ["How does middleware ordering work in Express, and how would you structure authentication middleware?"],
  "JavaScript": [
    "What is a closure in JavaScript? Give me a practical example of where you've used one.",
    "Explain the difference between == and ===, and how promises differ from async/await."
  ],
  "TypeScript": ["What problems does TypeScript solve for you, and how do you type an API response safely?"],
  "Python": [
    "What are Python generators and when would you use one instead of a list?",
    "How does Python manage memory, and what is the GIL's impact on multithreading?"
  ],
  "Java": [
    "How does a HashMap work internally in Java, and what happens on a collision?",
    "Explain the difference between an abstract class and an interface in Java."
  ],
  "C++": ["What's the difference between a pointer and a reference in C++, and when would you use smart pointers?"],
  "MongoDB": [
    "How do indexes work in MongoDB, and how would you find out a query is not using one?",
    "When would you embed documents versus reference them in MongoDB?"
  ],
  "SQL": ["Explain the different types of SQL joins with an example of when you'd use a LEFT JOIN."],
  "MySQL": ["How would you optimize a slow MySQL query on a table with millions of rows?"],
  "PostgreSQL": ["What are transactions and isolation levels, and which problems do they prevent?"],
  "DBMS": [
    "Explain normalization up to 3NF and when you might deliberately denormalize.",
    "What does ACID mean, and how does a database guarantee atomicity?"
  ],
  "DSA": [
    "When would you choose a hash map over a balanced binary search tree? Talk through the time complexities.",
    "How would you detect a cycle in a linked list, and what's the space complexity of your approach?"
  ],
  "Operating Systems": ["What is the difference between a process and a thread, and what causes a deadlock?"],
  "Computer Networks": ["Walk me through what happens when you type a URL into the browser and press Enter."],
  "REST APIs": ["What makes an API RESTful, and what does idempotency mean for PUT versus POST?"],
  "Docker": ["What problem does Docker solve, and what is the difference between an image and a container?"],
  "AWS": ["Which AWS services would you use to deploy a web app, and how would you keep it secure?"],
  "System Design": ["How would you design a URL shortener that handles millions of requests per day?"],
  "Machine Learning": ["How do you detect and handle overfitting in a model you've trained?"],
  "Git": ["How do you resolve a merge conflict, and what's the difference between merge and rebase?"],
  "OOP": ["Explain the four pillars of OOP with an example from one of your projects."]
};

export const ROUND_QUESTIONS = {
  Introduction: ["Hi {name}, thanks for joining today. To start, walk me through your background and what draws you to the {role} role."],
  Resume: [
    "Your resume mentions {skill}. Describe a specific situation where you used it to solve a real problem.",
    "How would you rate yourself in {skill2}, and what would it take to move one level higher?"
  ],
  Technical: [
    "Explain a core concept in {skill} that beginners often get wrong.",
    "How would you debug a performance issue in an application built with {skill2}?"
  ],
  Project: [
    "Let's talk about {project}. Walk me through its architecture and why you chose {tech}.",
    "What was the hardest technical challenge in {project}, and how did you resolve it?",
    "If {project} had to support 100 times more users, what would break first and how would you fix it?"
  ],
  Behavioral: [
    "Tell me about a time you disagreed with a teammate. How did you handle it and what was the outcome?",
    "Describe a time you made a mistake or missed a deadline. What did you learn from it?",
    "Tell me about a time you took ownership of something beyond your assigned responsibilities."
  ],
  Stress: [
    "It's Friday evening and production is down right after your deploy. Walk me through your first fifteen minutes.",
    "Your manager says your feature must ship in half the planned time. How do you respond and what do you cut?"
  ],
  Closing: ["We're close to the end. What's one thing you'd do differently in today's interview, and do you have any questions for me?"]
};

export const FOLLOW_UPS = [
  "Can you go one level deeper — what exactly did you implement, and what tradeoffs did you consider?",
  "Could you make that concrete with a specific example, ideally with numbers or results?",
  "What would you do differently if you had to build that again today?",
  "How would you explain that to a teammate who's new to the topic?"
];

export const CLOSING_MESSAGE =
  "Thank you, that wraps up the conversational part of the interview. Make sure your coding solution is submitted, then click End interview to generate your detailed report.";
