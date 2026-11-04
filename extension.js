const vscode = require("vscode");

let statusBar;
let timerInterval = null;
let timeLeftSeconds = 0;
let timerRunning = false;

function countWords(text) {
  const m = text.trim().match(/\S+/g);
  return m ? m.length : 0;
}

function getConfig() {
  return vscode.workspace.getConfiguration("examCounter");
}

function updateStatusBar() {
  const editor = vscode.window.activeTextEditor;
  const limit = getConfig().get("wordLimit");

  let text = "Words: 0";
  if (editor) {
    const words = countWords(editor.document.getText());
    const over = limit > 0 && words > limit;
    text = `Words: ${words} / ${limit}` + (over ? " ⏱ Time" : "");
  }

  if (timerRunning || timeLeftSeconds > 0) {
    const m = Math.floor(timeLeftSeconds / 60);
    const s = timeLeftSeconds % 60;
    text += ` ${m}:${String(s).padStart(2, "0")}`;
    if (timeLeftSeconds === 0 && !timerRunning) text += " (done)";
  }

  statusBar.text = text;
  statusBar.tooltip = "Click to adjust words / timer";
  statusBar.show();
}

// ---- Word limit adjustments ----

async function setWordLimit() {
  const input = await vscode.window.showInputBox({
    prompt: "Enter word limit (0 = no limit)",
    value: String(getConfig().get("wordLimit")),
  });
  if (input === undefined) return;
  const n = parseInt(input, 10);
  if (!isNaN(n) && n >= 0) {
    await getConfig().update("wordLimit", n, vscode.ConfigurationTarget.Global);
    updateStatusBar();
  } else {
    vscode.window.showWarningMessage(
      "Please enter a valid non-negative number.",
    );
  }
}

async function adjustWordLimit(delta) {
  const next = Math.max(0, getConfig().get("wordLimit") + delta);
  await getConfig().update(
    "wordLimit",
    next,
    vscode.ConfigurationTarget.Global,
  );
  updateStatusBar();
}

// ---- Timer adjustments (the new part) ----

async function setTimeMinutes() {
  const input = await vscode.window.showInputBox({
    prompt: "Set total time for the round, in minutes",
    value: String(getConfig().get("timeMinutes")),
  });
  if (input === undefined) return;
  const n = parseInt(input, 10);
  if (!isNaN(n) && n > 0) {
    await getConfig().update(
      "timeMinutes",
      n,
      vscode.ConfigurationTarget.Global,
    );
    timeLeftSeconds = n * 60; // apply immediately
    timerRunning = false;
    clearInterval(timerInterval);
    updateStatusBar();
  } else {
    vscode.window.showWarningMessage("Please enter a valid number of minutes.");
  }
}

async function adjustTime(deltaMinutes) {
  const current = getConfig().get("timeMinutes");
  const next = Math.max(1, current + deltaMinutes);
  await getConfig().update(
    "timeMinutes",
    next,
    vscode.ConfigurationTarget.Global,
  );
  // If timer not running yet, adjust the displayed countdown too
  if (!timerRunning) {
    timeLeftSeconds = next * 60;
  }
  updateStatusBar();
}

function startTimer() {
  const mins = getConfig().get("timeMinutes");
  if (!timerRunning) {
    timeLeftSeconds = mins * 60;
    timerRunning = true;
  }
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeLeftSeconds--;
    updateStatusBar();
    if (timeLeftSeconds <= 0) {
      clearInterval(timerInterval);
      timerRunning = false;
      vscode.window.showInformationMessage("⏱ Time is up!");
    }
  }, 1000);
  updateStatusBar();
}

function resetTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  timeLeftSeconds = getConfig().get("timeMinutes") * 60;
  updateStatusBar();
}

// ---- Click status bar -> menu to adjust either ----

async function showMenu() {
  const limit = getConfig().get("wordLimit");
  const mins = getConfig().get("timeMinutes");
  const mLeft = Math.floor(timeLeftSeconds / 60);
  const sLeft = timeLeftSeconds % 60;

  const pick = await vscode.window.showQuickPick(
    [
      { label: `📝 Set word limit (current: ${limit})`, action: "setWords" },
      { label: "📝 Word limit +10", action: "wordsUp" },
      { label: "📝 Word limit −10", action: "wordsDown" },
      { label: `⏱ Set round time (current: ${mins} min)`, action: "setTime" },
      { label: "⏱ Time +5 min", action: "timeUp" },
      { label: "⏱ Time −5 min", action: "timeDown" },
      {
        label: timerRunning
          ? "▶ Restart timer"
          : `▶ Start timer (${mLeft}:${String(sLeft).padStart(2, "0")} left)`,
        action: "start",
      },
      { label: "↺ Reset timer", action: "reset" },
    ],
    { placeHolder: "Adjust your exam counter" },
  );

  if (!pick) return;
  switch (pick.action) {
    case "setWords":
      return setWordLimit();
    case "wordsUp":
      return adjustWordLimit(10);
    case "wordsDown":
      return adjustWordLimit(-10);
    case "setTime":
      return setTimeMinutes();
    case "timeUp":
      return adjustTime(5);
    case "timeDown":
      return adjustTime(-5);
    case "start":
      return startTimer();
    case "reset":
      return resetTimer();
  }
}

function activate(context) {
  statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100,
  );
  statusBar.command = "examCounter.showMenu"; // click anywhere on the counter = menu
  context.subscriptions.push(statusBar);

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(updateStatusBar),
    vscode.window.onDidChangeActiveTextEditor(updateStatusBar),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("examCounter.showMenu", showMenu),
    vscode.commands.registerCommand("examCounter.setWordLimit", setWordLimit),
    vscode.commands.registerCommand("examCounter.increaseLimit", () =>
      adjustWordLimit(10),
    ),
    vscode.commands.registerCommand("examCounter.decreaseLimit", () =>
      adjustWordLimit(-10),
    ),
    vscode.commands.registerCommand(
      "examCounter.setTimeMinutes",
      setTimeMinutes,
    ),
    vscode.commands.registerCommand("examCounter.increaseTime", () =>
      adjustTime(5),
    ),
    vscode.commands.registerCommand("examCounter.decreaseTime", () =>
      adjustTime(-5),
    ),
    vscode.commands.registerCommand("examCounter.startTimer", startTimer),
    vscode.commands.registerCommand("examCounter.resetTimer", resetTimer),
  );

  timeLeftSeconds = getConfig().get("timeMinutes") * 60;
  updateStatusBar();
}

function deactivate() {
  clearInterval(timerInterval);
}

module.exports = { activate, deactivate };
