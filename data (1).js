/**
 * data.js — Mock sales data for 2022, 2023, 2024
 * Inspired by Kaggle retail / e-commerce datasets.
 * Structure mirrors typical Superstore / Online Retail II datasets.
 */

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const SALES_DATA = {
  2022: {
    monthly: [210, 185, 240, 265, 310, 298, 322, 345, 290, 330, 415, 480],
    units:   [1820,1640,2100,2310,2720,2580,2810,3010,2520,2880,3620,4200],
    categories: {
      Electronics: 38,
      Clothing:    22,
      Groceries:   18,
      Furniture:   12,
      Sports:      10
    }
  },
  2023: {
    monthly: [230, 210, 275, 295, 340, 325, 360, 385, 315, 370, 460, 540],
    units:   [2010,1840,2400,2560,2980,2840,3140,3360,2740,3220,4010,4710],
    categories: {
      Electronics: 35,
      Clothing:    25,
      Groceries:   20,
      Furniture:   11,
      Sports:       9
    }
  },
  2024: {
    monthly: [255, 230, 305, 325, 380, 362, 405, 428, 348, 412, 510, 598],
    units:   [2220,2010,2660,2830,3320,3150,3530,3730,3030,3590,4450,5210],
    categories: {
      Electronics: 33,
      Clothing:    27,
      Groceries:   21,
      Furniture:   11,
      Sports:       8
    }
  }
};

// Palette used across charts
const PALETTE = {
  accent:  "#E8FF47",   // sharp yellow-green
  accent2: "#FF6B6B",   // coral
  accent3: "#4ECDC4",   // teal
  accent4: "#FFB347",   // amber
  accent5: "#C77DFF",   // purple
  dimLine: "rgba(255,255,255,0.08)"
};

const CATEGORY_COLORS = [
  PALETTE.accent,
  PALETTE.accent2,
  PALETTE.accent3,
  PALETTE.accent4,
  PALETTE.accent5
];
