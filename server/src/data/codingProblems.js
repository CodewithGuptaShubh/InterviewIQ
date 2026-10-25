// Coding round problem bank. JavaScript solutions are executed against `tests`;
// other languages are reviewed by the evaluation agent.
// compare: "exact" (deep equal), "unordered" (sort top-level before comparing), "nested-unordered" (sort inner and outer arrays).

export const CODING_PROBLEMS = [
  {
    id: "reverse-words",
    title: "Reverse Words",
    difficulty: "beginner",
    functionName: "reverseWords",
    statement: "Given a string s, return a new string with the order of the words reversed. Words are separated by one or more spaces; the result should have single spaces and no leading or trailing spaces.",
    examples: [{ input: 's = "  the sky   is blue "', output: '"blue is sky the"' }],
    constraints: ["1 <= s.length <= 10^4"],
    params: ["s"],
    tests: [
      { args: ["the sky is blue"], expected: "blue is sky the" },
      { args: ["  hello world  "], expected: "world hello" },
      { args: ["a good   example"], expected: "example good a" },
      { args: ["single"], expected: "single" }
    ]
  },
  {
    id: "valid-parentheses",
    title: "Valid Parentheses",
    difficulty: "beginner",
    functionName: "isValid",
    statement: "Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid. Brackets must be closed by the same type and in the correct order.",
    examples: [
      { input: 's = "()[]{}"', output: "true" },
      { input: 's = "(]"', output: "false" }
    ],
    constraints: ["1 <= s.length <= 10^4"],
    params: ["s"],
    tests: [
      { args: ["()"], expected: true },
      { args: ["()[]{}"], expected: true },
      { args: ["(]"], expected: false },
      { args: ["([)]"], expected: false },
      { args: ["{[]}"], expected: true },
      { args: ["(("], expected: false }
    ]
  },
  {
    id: "two-sum",
    title: "Two Sum",
    difficulty: "intermediate",
    functionName: "twoSum",
    statement: "Given an array of integers nums and an integer target, return the indices of the two numbers that add up to target. Each input has exactly one solution, and you may not use the same element twice.",
    examples: [{ input: "nums = [2,7,11,15], target = 9", output: "[0,1]" }],
    constraints: ["2 <= nums.length <= 10^4", "Aim for better than O(n^2)"],
    params: ["nums", "target"],
    compare: "unordered",
    tests: [
      { args: [[2, 7, 11, 15], 9], expected: [0, 1] },
      { args: [[3, 2, 4], 6], expected: [1, 2] },
      { args: [[3, 3], 6], expected: [0, 1] },
      { args: [[-1, -2, -3, -4, -5], -8], expected: [2, 4] }
    ]
  },
  {
    id: "group-anagrams",
    title: "Group Anagrams",
    difficulty: "intermediate",
    functionName: "groupAnagrams",
    statement: "Given an array of strings strs, group the anagrams together. You can return the groups in any order.",
    examples: [{ input: 'strs = ["eat","tea","tan","ate","nat","bat"]', output: '[["bat"],["nat","tan"],["ate","eat","tea"]]' }],
    constraints: ["1 <= strs.length <= 10^4"],
    params: ["strs"],
    compare: "nested-unordered",
    tests: [
      { args: [["eat", "tea", "tan", "ate", "nat", "bat"]], expected: [["bat"], ["nat", "tan"], ["ate", "eat", "tea"]] },
      { args: [[""]], expected: [[""]] },
      { args: [["a"]], expected: [["a"]] },
      { args: [["abc", "bca", "xyz", "zyx", "q"]], expected: [["abc", "bca"], ["xyz", "zyx"], ["q"]] }
    ]
  },
  {
    id: "longest-substring",
    title: "Longest Substring Without Repeating Characters",
    difficulty: "advanced",
    functionName: "lengthOfLongestSubstring",
    statement: "Given a string s, find the length of the longest substring without repeating characters.",
    examples: [
      { input: 's = "abcabcbb"', output: "3", explanation: 'The answer is "abc".' },
      { input: 's = "pwwkew"', output: "3" }
    ],
    constraints: ["0 <= s.length <= 5 * 10^4", "Aim for O(n)"],
    params: ["s"],
    tests: [
      { args: ["abcabcbb"], expected: 3 },
      { args: ["bbbbb"], expected: 1 },
      { args: ["pwwkew"], expected: 3 },
      { args: [""], expected: 0 },
      { args: ["dvdf"], expected: 3 },
      { args: ["abba"], expected: 2 }
    ]
  },
  {
    id: "merge-intervals",
    title: "Merge Intervals",
    difficulty: "advanced",
    functionName: "merge",
    statement: "Given an array of intervals where intervals[i] = [start, end], merge all overlapping intervals and return an array of the non-overlapping intervals sorted by start.",
    examples: [{ input: "intervals = [[1,3],[2,6],[8,10],[15,18]]", output: "[[1,6],[8,10],[15,18]]" }],
    constraints: ["1 <= intervals.length <= 10^4"],
    params: ["intervals"],
    tests: [
      { args: [[[1, 3], [2, 6], [8, 10], [15, 18]]], expected: [[1, 6], [8, 10], [15, 18]] },
      { args: [[[1, 4], [4, 5]]], expected: [[1, 5]] },
      { args: [[[1, 4], [0, 4]]], expected: [[0, 4]] },
      { args: [[[1, 4], [2, 3]]], expected: [[1, 4]] }
    ]
  }
];

export function starterCode(problem) {
  const params = problem.params.join(", ");
  return {
    javascript: `function ${problem.functionName}(${params}) {\n  // Write your solution here\n}\n`,
    python: `def ${toSnake(problem.functionName)}(${params}):\n    # Write your solution here\n    pass\n`,
    java: `class Solution {\n    // Write your solution for ${problem.functionName} here\n}\n`,
    cpp: `#include <bits/stdc++.h>\nusing namespace std;\n\n// Write your solution for ${problem.functionName} here\n`,
    c: `#include <stdio.h>\n\n// Write your solution for ${problem.functionName} here\n`
  };
}

function toSnake(name) {
  return name.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
}

export function pickProblem(difficulty) {
  const pool = CODING_PROBLEMS.filter((problem) => problem.difficulty === difficulty);
  const options = pool.length ? pool : CODING_PROBLEMS;
  return options[Math.floor(Math.random() * options.length)];
}

export function findProblem(id) {
  return CODING_PROBLEMS.find((problem) => problem.id === id) || CODING_PROBLEMS[2];
}

export function publicProblem(problem) {
  return {
    id: problem.id,
    title: problem.title,
    difficulty: problem.difficulty,
    functionName: problem.functionName,
    statement: problem.statement,
    examples: problem.examples,
    constraints: problem.constraints,
    starterCode: starterCode(problem),
    totalTests: problem.tests.length
  };
}
