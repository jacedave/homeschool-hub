import { Contribution, Kid, MealItem, RewardItem, ShoppingItem, TaskItem } from "./types";

export const DEMO_KIDS: Kid[] = [
  { id: "k1", name: "Alex", stars: 14, color: "blue" },
  { id: "k2", name: "Sam", stars: 11, color: "emerald" },
  { id: "k3", name: "Jordan", stars: 9, color: "amber" },
  { id: "k4", name: "Taylor", stars: 7, color: "purple" },
];

const t = (
  id: string,
  title: string,
  assignee: string,
  category: TaskItem["category"],
  points: number,
  repeat: TaskItem["repeat"] = "daily"
): TaskItem => ({
  id,
  title,
  assignee,
  category,
  points,
  completed: false,
  repeat,
  repeatDays: [],
  dueToday: true,
});

export const DEMO_TASKS: TaskItem[] = [
  t("t1", "Math Lesson", "Alex", "school", 2, "weekdays"),
  t("t2", "Reading (20 mins)", "Alex", "school", 1),
  t("t3", "Make Bed & Tidy Room", "Alex", "chore", 1),
  t("t4", "Phonics & Spelling", "Sam", "school", 2, "weekdays"),
  t("t5", "Feed Backyard Chickens", "Sam", "chore", 2),
  t("t6", "Science Experiment", "Jordan", "school", 2, "none"),
  t("t7", "Clear Dinner Dishes", "Jordan", "chore", 1),
  t("t8", "Colors & Numbers", "Taylor", "school", 1, "weekdays"),
  t("t9", "Put Toys in Bin", "Taylor", "chore", 1),
];

export const DEMO_REWARDS: RewardItem[] = [
  { id: "r1", title: "30 Mins Screen Time", cost: 10, icon: "🎮", combinable: false },
  { id: "r2", title: "Ice Cream Sundae Night", cost: 20, icon: "🍨", combinable: true },
  { id: "r3", title: "Pick Friday Family Movie", cost: 25, icon: "🍿", combinable: false },
  { id: "r4", title: "Stay Up 30 Mins Late", cost: 15, icon: "🌙", combinable: false },
  { id: "r5", title: "Special Trip with Dad", cost: 40, icon: "🥏", combinable: true },
];

export const DEMO_CONTRIBUTIONS: Contribution[] = [
  { id: "c1", rewardId: "r5", kidId: "k1", amount: 6 },
  { id: "c2", rewardId: "r5", kidId: "k3", amount: 4 },
  { id: "c3", rewardId: "r3", kidId: "k1", amount: 8 },
  { id: "c4", rewardId: "r3", kidId: "k2", amount: 3 },
];

export const DEMO_MEALS: MealItem[] = [
  { id: "m1", date: "", day: "Monday", breakfast: "Oatmeal & Berries", lunch: "Turkey Wraps", dinner: "Taco Night" },
  { id: "m2", date: "", day: "Tuesday", breakfast: "Scrambled Eggs", lunch: "Quesadillas", dinner: "Baked Ziti & Salad" },
  { id: "m3", date: "", day: "Wednesday", breakfast: "Fresh Milled Pancakes", lunch: "Leftovers", dinner: "Slow Cooker Roast" },
  { id: "m4", date: "", day: "Thursday", breakfast: "Yogurt & Granola", lunch: "Grilled Cheese", dinner: "Teriyaki Chicken Bowls" },
  { id: "m5", date: "", day: "Friday", breakfast: "Bagels & Cream Cheese", lunch: "Picnic at the Park", dinner: "Homemade Pizza Night" },
  { id: "m6", date: "", day: "Saturday", breakfast: "Waffles & Bacon", lunch: "Sandwiches", dinner: "Burgers on the Grill" },
  { id: "m7", date: "", day: "Sunday", breakfast: "Cinnamon Rolls", lunch: "Sunday Roast", dinner: "Soup & Fresh Bread" },
];

export const DEMO_SHOPPING: ShoppingItem[] = [
  { id: "s1", item: "Whole Wheat Berries", category: "Pantry", checked: false },
  { id: "s2", item: "Raw Milk & Heavy Cream", category: "Dairy", checked: false },
  { id: "s3", item: "Apples & Bananas", category: "Produce", checked: false },
  { id: "s4", item: "Mozzarella Cheese", category: "Dairy", checked: true },
];
