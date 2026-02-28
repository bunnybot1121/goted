// tutorial.js - The Goted Mascot Guide

const tutorialSteps = [
    {
        target: null, // Center screen
        title: "WELCOME TO THE GOTED!",
        text: "Hey, myself Bupi! Ready for a quick tour of your new Neo-Brutalist second brain?",
        position: "center"
    },
    {
        target: "button[onclick*=\"'dashboard'\"]",
        title: "DASHBOARD",
        text: "Your central hub! See recent activity, filter by category, and access your quick mind maps.",
        position: "right"
    },
    {
        target: "button[onclick*=\"'braindump'\"]",
        title: "BRAIN DUMP",
        text: "Quickly capture ideas without overthinking. Type away and Crystallize them into your vault.",
        position: "right"
    },
    {
        target: "button[onclick*=\"'gallery'\"]",
        title: "VAULT GALLERY",
        text: "View all your captured notes, links, and ideas. Filter and search easily!",
        position: "right"
    },
    {
        target: "button[onclick*=\"'mindmap'\"]",
        title: "MIND MAPS",
        text: "Connect your ideas spatially. Drag nodes, link them together, and see the big picture.",
        position: "right"
    },
    {
        target: "button[onclick*=\"'flashcards'\"]",
        title: "FLASHCARDS",
        text: "Turn your vault entries into flashcards to study and memorize important concepts.",
        position: "right"
    },
    {
        target: "button[onclick*=\"'trash'\"]",
        title: "TRASH & ARCHIVE",
        text: "Keep your vault clean. Items here can be restored or permanently incinerated.",
        position: "right"
    },
    {
        target: "button[onclick*=\"'collab'\"]",
        title: "COLLAB",
        text: "Connect with friends! View their active maps, approve peeks, and share knowledge.",
        position: "right"
    },
    {
        target: "button[onclick=\"openAdd()\"]",
        title: "QUICK ADD",
        text: "Use the global ADD button to instantly drop a note, link, or idea into the vault without losing focus.",
        position: "bottom-left"
    },
    {
        target: "button[onclick=\"doLogout()\"]",
        title: "EXIT",
        text: "When you're done, safely log out of your session here.",
        position: "bottom-left"
    }
];

let currentStep = 0;
let tutorialContainer = null;
let tutorialHighlight = null;

function initTutorial(force = false) {
    const hasSeen = localStorage.getItem('goted_tutorial_seen');
    if (hasSeen && !force) return;

    if (!document.getElementById('tutorial-container')) {
        buildTutorialUI();
    }

    // Only start if not on login screen
    const loginView = document.getElementById('login');
    if (!loginView || !loginView.classList.contains('hidden')) {
        // Wait for login to finish
        return;
    }

    currentStep = 0;
    tutorialContainer.classList.remove('hidden');
    showStep(currentStep);
}

function buildTutorialUI() {
    // Backdrop
    tutorialContainer = document.createElement('div');
    tutorialContainer.id = 'tutorial-container';
    tutorialContainer.className = 'hidden fixed inset-0 z-[100] pointer-events-none transition-all duration-300';

    // Dark overlay
    const overlay = document.createElement('div');
    overlay.className = 'absolute inset-0 bg-black/40 pointer-events-auto';
    tutorialContainer.appendChild(overlay);

    // Highlight Box
    tutorialHighlight = document.createElement('div');
    tutorialHighlight.id = 'tutorial-highlight';
    tutorialHighlight.className = 'absolute border-4 border-neo-pink rounded-xl shadow-[0_0_15px_#FF90E8] pointer-events-none transition-all duration-500 ease-out z-[101]';
    tutorialContainer.appendChild(tutorialHighlight);

    // Mascot + Dialog Wrapper
    const dialogWrapper = document.createElement('div');
    dialogWrapper.id = 'tutorial-dialog';
    dialogWrapper.className = 'absolute flex items-start gap-4 z-[102] transition-all duration-500 ease-out pointer-events-auto max-w-[90vw] md:max-w-md';

    // Cute Mascot SVG
    const mascot = document.createElement('div');
    mascot.className = 'flex-shrink-0 animate-bounce cursor-pointer';
    mascot.onclick = () => showMascotAnimation();
    mascot.innerHTML = `
    <div id="mascot-body" class="w-16 h-16 md:w-20 md:h-20 bg-primary border-4 border-black shadow-neo rounded-xl flex flex-col items-center justify-center relative transition-all duration-300 transform mt-4">
      <!-- Antenna -->
      <div class="absolute -top-4 w-2 h-4 bg-black"></div>
      <div class="absolute -top-6 w-4 h-4 rounded-full bg-neo-pink border-2 border-black animate-pulse shadow-neo-sm"></div>
      
      <!-- Visor -->
      <div class="w-12 h-6 md:w-14 md:h-8 bg-black rounded-lg border-2 border-neo-blue shadow-[inset_0_0_10px_#23F0C7] flex items-center justify-center gap-2 overflow-hidden relative">
         <!-- Eyes -->
         <div class="w-2 h-2 md:w-3 md:h-3 bg-accent rounded-sm animate-pulse shadow-[0_0_5px_#23F0C7]"></div>
         <div class="w-2 h-2 md:w-3 md:h-3 bg-accent rounded-sm animate-pulse shadow-[0_0_5px_#23F0C7]"></div>
      </div>
      
      <!-- Mouth details -->
      <div class="mt-2 flex gap-1">
        <div class="w-1.5 h-1.5 bg-black rounded-sm border-b border-white/30"></div>
        <div class="w-3 h-1.5 bg-black rounded-sm border-b border-white/30"></div>
        <div class="w-1.5 h-1.5 bg-black rounded-sm border-b border-white/30"></div>
      </div>
    </div>
  `;

    // Speech Bubble
    const bubble = document.createElement('div');
    bubble.className = 'bg-white border-4 border-black p-4 rounded-2xl shadow-neo relative min-w-[200px] flex-1';
    bubble.innerHTML = `
    <div class="absolute w-4 h-4 bg-white border-l-4 border-t-4 border-black -left-[10px] top-6 transform -rotate-45 hidden md:block" id="bubble-arrow"></div>
    <div class="flex justify-between items-start mb-2">
      <h3 id="tut-title" class="font-bold text-black uppercase tracking-wider text-sm md:text-base">TITLE</h3>
      <span class="text-[10px] font-mono font-bold bg-neo-yellow px-1 border border-black rounded" id="tut-progress">1/5</span>
    </div>
    <p id="tut-text" class="text-xs md:text-sm font-mono text-black leading-relaxed mb-4">Description text</p>
    <div class="flex justify-between items-center mt-2 border-t-2 border-dashed border-gray-300 pt-3">
      <button onclick="endTutorial()" class="text-[10px] font-bold uppercase text-gray-500 hover:text-black">Skip Tour</button>
      <button onclick="nextTutorialStep()" id="tut-next-btn" class="bg-neo-pink text-black border-2 border-black px-4 py-1.5 rounded-lg text-xs font-bold uppercase shadow-neo-sm hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-none transition-all">
        NEXT ➔
      </button>
    </div>
  `;

    dialogWrapper.appendChild(mascot);
    dialogWrapper.appendChild(bubble);
    tutorialContainer.appendChild(dialogWrapper);

    document.body.appendChild(tutorialContainer);
}

function showStep(index) {
    const step = tutorialSteps[index];
    if (!step) {
        endTutorial();
        return;
    }

    const titleEl = document.getElementById('tut-title');
    const textEl = document.getElementById('tut-text');
    const progEl = document.getElementById('tut-progress');
    const nextBtn = document.getElementById('tut-next-btn');
    const dialog = document.getElementById('tutorial-dialog');
    const highlight = document.getElementById('tutorial-highlight');

    titleEl.innerText = step.title;
    textEl.innerText = step.text;
    progEl.innerText = `${index + 1}/${tutorialSteps.length}`;
    nextBtn.innerText = (index === tutorialSteps.length - 1) ? "LET'S GO!" : "NEXT ➔";

    if (step.target) {
        const targetEl = document.querySelector(step.target);
        if (targetEl) {
            // Ensure target is visible
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

            setTimeout(() => {
                const rect = targetEl.getBoundingClientRect();

                // Setup Highlight
                highlight.style.opacity = '1';
                const p = 8; // padding
                highlight.style.top = (rect.top - p) + 'px';
                highlight.style.left = (rect.left - p) + 'px';
                highlight.style.width = (rect.width + p * 2) + 'px';
                highlight.style.height = (rect.height + p * 2) + 'px';

                // Position dialog based on step.position
                positionDialog(dialog, rect, step.position);
            }, 300); // Wait for scroll
        } else {
            // Fallback to center if element not found
            centerDialog(dialog);
            highlight.style.opacity = '0';
        }
    } else {
        // Center screen
        centerDialog(dialog);
        highlight.style.opacity = '0';
    }
}

function positionDialog(dialog, rect, position) {
    // Reset classes for layout direction
    dialog.className = 'absolute flex items-start gap-4 z-[102] transition-all duration-500 ease-out pointer-events-auto max-w-[90vw] md:max-w-md';
    const arrow = document.getElementById('bubble-arrow');
    arrow.className = 'absolute w-4 h-4 bg-white border-l-4 border-t-4 border-black hidden md:block transition-all';

    const scrollY = window.scrollY || document.documentElement.scrollTop;
    const padding = 20;

    if (position === 'center') {
        centerDialog(dialog);
        return;
    }

    if (position === 'right') {
        dialog.style.top = (rect.top + scrollY) + 'px';
        dialog.style.left = (rect.right + padding) + 'px';
        arrow.style.left = '-10px';
        arrow.style.top = '30px';
        arrow.style.transform = 'rotate(-45deg)';
        arrow.style.borderWidth = '4px 0 0 4px';
    } else if (position === 'bottom-left') {
        dialog.style.flexDirection = 'row-reverse';
        dialog.style.top = (rect.bottom + padding) + 'px';
        dialog.style.left = (rect.left - 300) + 'px'; // approx width

        arrow.style.right = '40px';
        arrow.style.top = '-10px';
        arrow.style.transform = 'rotate(45deg)';
        arrow.style.borderWidth = '4px 0 0 4px';
        arrow.style.left = 'auto';
    } else if (position === 'top') {
        dialog.style.top = (rect.top + scrollY - 200) + 'px'; // approx height
        dialog.style.left = rect.left + 'px';
        arrow.style.left = '40px';
        arrow.style.bottom = '-10px';
        arrow.style.top = 'auto';
        arrow.style.transform = 'rotate(-135deg)';
        arrow.style.borderWidth = '4px 0 0 4px';
    } else {
        centerDialog(dialog); // fallback
    }

    // Mobile constraint (force centerish if screen is too small)
    if (window.innerWidth < 768) {
        dialog.style.left = '5vw';
        dialog.style.top = (rect.bottom + padding + scrollY) + 'px';
        arrow.style.display = 'none';
    } else {
        arrow.style.display = 'block';
    }
}

function centerDialog(dialog) {
    dialog.style.top = '50%';
    dialog.style.left = '50%';
    dialog.style.transform = 'translate(-50%, -50%)';
    const arrow = document.getElementById('bubble-arrow');
    if (arrow) arrow.style.display = 'none';
}

function showMascotAnimation() {
    const body = document.getElementById('mascot-body');
    body.classList.replace('bg-primary', 'bg-neo-pink');
    body.style.transform = 'scale(1.1) rotate(10deg)';
    setTimeout(() => {
        body.classList.replace('bg-neo-pink', 'bg-primary');
        body.style.transform = 'scale(1) rotate(0deg)';
    }, 400);
}

window.nextTutorialStep = function () {
    currentStep++;
    if (currentStep >= tutorialSteps.length) {
        endTutorial();
    } else {
        showStep(currentStep);
    }
};

window.endTutorial = function () {
    localStorage.setItem('goted_tutorial_seen', 'true');
    if (tutorialContainer) {
        tutorialContainer.classList.add('opacity-0');
        setTimeout(() => {
            tutorialContainer.classList.add('hidden');
            tutorialContainer.classList.remove('opacity-0');
        }, 300);
    }
};

// Listen for custom event or export function
window.startTutorial = initTutorial;
