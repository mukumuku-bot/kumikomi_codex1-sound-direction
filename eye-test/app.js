const eyes = document.querySelector("#dogEyes");
const pupilGroup = document.querySelector("#pupilGroup");
const currentExpression = document.querySelector("#currentExpression");
const expressionButtons = document.querySelectorAll("[data-expression]");
const actionButtons = document.querySelectorAll("[data-action]");
const lookButtons = document.querySelectorAll("[data-look]");
const expressions = [
  "happy",
  "very_happy",
  "sad",
];

const expressionLabels = {
  happy: "嬉しい",
  very_happy: "とても嬉しい",
  sad: "悲しい・元気がない",
};

expressionButtons.forEach((button) => {
  button.addEventListener("click", () => setExpression(button.dataset.expression));
});

actionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const action = button.dataset.action;
    if (action === "blink") blink();
    if (action === "sleep") sleep();
    if (action === "wake") wake();
  });
});

lookButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const [x, y] = button.dataset.look.split(",").map(Number);
    lookAt(x, y);
  });
});

setExpression("happy");

function setExpression(expression) {
  const nextExpression = expressions.includes(expression) ? expression : "happy";
  eyes.dataset.expression = nextExpression;
  eyes.classList.remove("is-sleeping");
  currentExpression.textContent = `現在: ${expressionLabels[nextExpression] || nextExpression}`;
  expressionButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.expression === nextExpression);
  });
}

function blink() {
  eyes.classList.add("is-blinking");
  window.setTimeout(() => eyes.classList.remove("is-blinking"), 190);
}

function sleep() {
  eyes.classList.remove("is-blinking");
  eyes.classList.add("is-sleeping");
  setExpression("sad");
  eyes.classList.add("is-sleeping");
}

function wake() {
  eyes.classList.remove("is-sleeping");
  setExpression("happy");
  blink();
}

function lookAt(x, y) {
  pupilGroup.setAttribute("transform", `translate(${x} ${y})`);
}
