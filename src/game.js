import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import '../style.css';

// Game constants
const GRAVITY = -0.012;
const JUMP_FORCE = 0.32;
const MOVE_ACCELERATION = 0.25;
const MAX_MOVE_SPEED = 0.15;
const FRICTION = 0.75;
const AIR_FRICTION = 0.8;
const PLATFORM_WIDTH = 2.5;
const PLATFORM_HEIGHT = 0.3;
const PLATFORM_DEPTH = 2.5;
const PLAYER_WIDTH = 0.8;
const PLAYER_HEIGHT = 1.5;
const PLATFORM_SPACING_MIN = 1.8;
const PLATFORM_SPACING_MAX = 3.2;
const HORIZONTAL_RANGE = 4;
const INITIAL_PLATFORMS = 25;
const MAX_LEADERBOARD_ENTRIES = 10;

// Camera scroll speed (constant upward movement)
const CAMERA_SCROLL_SPEED_INITIAL = 0.02;
const CAMERA_SCROLL_SPEED_INCREMENT = 0.0001; // Speed increases over time
const CAMERA_SCROLL_SPEED_MAX = 0.08;

// Game state
let scene, camera, renderer;
let player;
let playerModel = null;
let platforms = [];
let velocity = { x: 0, y: 0 };
let isOnGround = false;
let score = 0;
let gameRunning = false;
let keys = {};
let cameraScrollSpeed = CAMERA_SCROLL_SPEED_INITIAL;
let gameOverTriggered = false;
let gameTime = 0;

// DOM elements
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('high-score');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreElement = document.getElementById('final-score');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const saveScoreBtn = document.getElementById('save-score-btn');
const playerNameInput = document.getElementById('player-name');
const newHighScoreDiv = document.getElementById('new-high-score');
const leaderboardList = document.getElementById('leaderboard-list');
const gameOverLeaderboardList = document.getElementById('game-over-leaderboard-list');

// Initialize Three.js
function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    scene.fog = new THREE.Fog(0x1a1a2e, 15, 60);

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 5, 14);
    camera.lookAt(0, 5, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.insertBefore(renderer.domElement, document.body.firstChild);

    // Lights
    const ambientLight = new THREE.AmbientLight(0x606080, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(5, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
    scene.add(directionalLight);

    const pointLight1 = new THREE.PointLight(0x00ff88, 0.4, 25);
    pointLight1.position.set(-5, 10, 5);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xff4488, 0.3, 25);
    pointLight2.position.set(5, 15, 5);
    scene.add(pointLight2);

    // Add background particles
    createBackgroundParticles();

    // Preload player model
    loadPlayerModel();

    // Window resize handler
    window.addEventListener('resize', onWindowResize);

    // Keyboard controls
    window.addEventListener('keydown', (e) => {
        keys[e.code] = true;
        if ((e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') && gameRunning) {
            e.preventDefault();
        }
    });
    window.addEventListener('keyup', (e) => {
        keys[e.code] = false;
    });

    // Button event listeners
    startBtn.addEventListener('click', startGame);
    restartBtn.addEventListener('click', startGame);
    saveScoreBtn.addEventListener('click', saveScore);

    // Load and display leaderboard
    loadLeaderboard().then(() => {
        renderLeaderboard(leaderboardList);
        updateHighScoreDisplay();
    });

    // Initial render
    renderer.render(scene, camera);
}

function loadPlayerModel() {
    const mtlLoader = new MTLLoader();
    mtlLoader.setPath('/assets/');

    mtlLoader.load('Madara_Uchiha.mtl', (materials) => {
        materials.preload();

        // Fix material paths - they reference absolute Windows paths
        Object.values(materials.materials).forEach(material => {
            material.color = new THREE.Color(0xcc4444);
            material.emissive = new THREE.Color(0x331111);
            material.emissiveIntensity = 0.2;
        });

        const objLoader = new OBJLoader();
        objLoader.setMaterials(materials);
        objLoader.setPath('/assets/');

        objLoader.load('Madara_Uchiha.obj', (object) => {
            playerModel = object;

            // Calculate bounding box to scale properly
            const box = new THREE.Box3().setFromObject(object);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = PLAYER_HEIGHT / maxDim;

            playerModel.scale.set(scale, scale, scale);

            // Center the model
            const center = box.getCenter(new THREE.Vector3());
            playerModel.position.sub(center.multiplyScalar(scale));

            // Apply shadow settings
            playerModel.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            console.log('Madara model loaded successfully');
        },
        (xhr) => {
            console.log((xhr.loaded / xhr.total * 100) + '% loaded');
        },
        (error) => {
            console.error('Error loading OBJ:', error);
            playerModel = null;
        });
    },
    (xhr) => {
        console.log('MTL ' + (xhr.loaded / xhr.total * 100) + '% loaded');
    },
    (error) => {
        console.error('Error loading MTL, loading OBJ without materials:', error);

        // Load OBJ without materials
        const objLoader = new OBJLoader();
        objLoader.setPath('/assets/');

        objLoader.load('Madara_Uchiha.obj', (object) => {
            playerModel = object;

            // Apply default material
            const material = new THREE.MeshStandardMaterial({
                color: 0xcc4444,
                emissive: 0x331111,
                emissiveIntensity: 0.2,
                metalness: 0.3,
                roughness: 0.7
            });

            object.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    child.material = material;
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            // Scale
            const box = new THREE.Box3().setFromObject(object);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = PLAYER_HEIGHT / maxDim;
            playerModel.scale.set(scale, scale, scale);

            console.log('Madara model loaded (without textures)');
        });
    });
}

function createBackgroundParticles() {
    const particleCount = 300;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
        positions[i] = (Math.random() - 0.5) * 50;
        positions[i + 1] = Math.random() * 150;
        positions[i + 2] = (Math.random() - 0.5) * 50 - 15;

        const color = new THREE.Color();
        color.setHSL(0.4 + Math.random() * 0.3, 0.7, 0.5);
        colors[i] = color.r;
        colors[i + 1] = color.g;
        colors[i + 2] = color.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        size: 0.15,
        vertexColors: true,
        transparent: true,
        opacity: 0.7
    });

    const particles = new THREE.Points(geometry, material);
    particles.name = 'backgroundParticles';
    scene.add(particles);
}

function createPlayer() {
    // Create player container
    player = new THREE.Group();
    player.position.set(0, 2, 0);

    if (playerModel) {
        // Clone the preloaded model
        const modelClone = playerModel.clone();
        modelClone.rotation.y = Math.PI; // Face camera
        player.add(modelClone);
    } else {
        // Fallback: create a simple character shape
        const bodyGeometry = new THREE.CapsuleGeometry(0.3, 0.8, 8, 16);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0xcc4444,
            emissive: 0x331111,
            emissiveIntensity: 0.3,
            metalness: 0.4,
            roughness: 0.6
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.castShadow = true;
        body.receiveShadow = true;
        player.add(body);

        // Head
        const headGeometry = new THREE.SphereGeometry(0.25, 16, 16);
        const head = new THREE.Mesh(headGeometry, bodyMaterial);
        head.position.y = 0.7;
        head.castShadow = true;
        player.add(head);
    }

    // Add glow effect underneath
    const glowGeometry = new THREE.CircleGeometry(0.5, 32);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff88,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -PLAYER_HEIGHT / 2 + 0.05;
    glow.name = 'playerGlow';
    player.add(glow);

    scene.add(player);
}

function createPlatform(x, y, z, isStartPlatform = false) {
    const width = isStartPlatform ? PLATFORM_WIDTH * 1.8 : PLATFORM_WIDTH;
    const geometry = new THREE.BoxGeometry(width, PLATFORM_HEIGHT, PLATFORM_DEPTH);

    // Color based on height - gradient from cyan to purple
    const hue = (y / 80) % 1;
    const color = new THREE.Color();
    color.setHSL(0.5 + hue * 0.4, 0.8, 0.45);

    const material = new THREE.MeshStandardMaterial({
        color: color,
        metalness: 0.4,
        roughness: 0.6,
        emissive: color,
        emissiveIntensity: 0.1
    });

    const platform = new THREE.Mesh(geometry, material);
    platform.position.set(x, y, z);
    platform.castShadow = true;
    platform.receiveShadow = true;

    // Store platform data
    platform.userData = {
        width: width,
        height: PLATFORM_HEIGHT,
        depth: PLATFORM_DEPTH
    };

    scene.add(platform);
    platforms.push(platform);

    // Add glowing edge
    const edgeGeometry = new THREE.EdgesGeometry(geometry);
    const edgeMaterial = new THREE.LineBasicMaterial({
        color: 0x00ffaa,
        transparent: true,
        opacity: 0.6
    });
    const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    platform.add(edges);

    // Add top surface glow
    const topGlowGeometry = new THREE.PlaneGeometry(width - 0.1, PLATFORM_DEPTH - 0.1);
    const topGlowMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff88,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide
    });
    const topGlow = new THREE.Mesh(topGlowGeometry, topGlowMaterial);
    topGlow.rotation.x = -Math.PI / 2;
    topGlow.position.y = PLATFORM_HEIGHT / 2 + 0.01;
    platform.add(topGlow);

    return platform;
}

function generatePlatforms() {
    // Clear existing platforms
    platforms.forEach(p => scene.remove(p));
    platforms = [];

    // Create starting platform (larger)
    createPlatform(0, 0, 0, true);

    // Generate platforms going up
    let currentY = PLATFORM_SPACING_MIN;
    for (let i = 0; i < INITIAL_PLATFORMS; i++) {
        const x = (Math.random() - 0.5) * HORIZONTAL_RANGE * 2;
        const spacing = PLATFORM_SPACING_MIN + Math.random() * (PLATFORM_SPACING_MAX - PLATFORM_SPACING_MIN);
        createPlatform(x, currentY, 0);
        currentY += spacing;
    }
}

function addNewPlatforms() {
    // Get highest platform
    let highestY = 0;
    platforms.forEach(p => {
        if (p.position.y > highestY) highestY = p.position.y;
    });

    // Add new platforms above camera view
    const targetHeight = camera.position.y + 40;
    while (highestY < targetHeight) {
        const x = (Math.random() - 0.5) * HORIZONTAL_RANGE * 2;
        const spacing = PLATFORM_SPACING_MIN + Math.random() * (PLATFORM_SPACING_MAX - PLATFORM_SPACING_MIN);
        highestY += spacing;
        createPlatform(x, highestY, 0);
    }

    // Remove platforms far below camera
    const removeThreshold = camera.position.y - 15;
    platforms = platforms.filter(p => {
        if (p.position.y < removeThreshold) {
            scene.remove(p);
            return false;
        }
        return true;
    });
}

function checkCollisions() {
    if (velocity.y > 0) return; // Only check when falling

    const playerBottom = player.position.y - PLAYER_HEIGHT / 2;
    const playerLeft = player.position.x - PLAYER_WIDTH / 2;
    const playerRight = player.position.x + PLAYER_WIDTH / 2;
    const playerFront = player.position.z - PLAYER_WIDTH / 2;
    const playerBack = player.position.z + PLAYER_WIDTH / 2;

    isOnGround = false;

    for (const platform of platforms) {
        const platTop = platform.position.y + platform.userData.height / 2;
        const platBottom = platform.position.y - platform.userData.height / 2;
        const platLeft = platform.position.x - platform.userData.width / 2;
        const platRight = platform.position.x + platform.userData.width / 2;
        const platFront = platform.position.z - platform.userData.depth / 2;
        const platBack = platform.position.z + platform.userData.depth / 2;

        // Check if player is above platform and within horizontal bounds
        if (playerBottom <= platTop && playerBottom >= platBottom - 0.3 &&
            playerRight > platLeft && playerLeft < platRight &&
            playerBack > platFront && playerFront < platBack) {

            // Land on platform
            player.position.y = platTop + PLAYER_HEIGHT / 2;
            velocity.y = 0;
            isOnGround = true;

            // Add landing effect
            const glow = player.getObjectByName('playerGlow');
            if (glow) {
                glow.material.opacity = 0.6;
            }
            break;
        }
    }
}

function updatePlayer(deltaTime) {
    if (!gameRunning) return;

    // Responsive horizontal movement - minimal sliding
    if (keys['KeyA'] || keys['ArrowLeft']) {
        velocity.x = -MAX_MOVE_SPEED;
    } else if (keys['KeyD'] || keys['ArrowRight']) {
        velocity.x = MAX_MOVE_SPEED;
    } else {
        // Quick stop with high friction
        velocity.x *= isOnGround ? FRICTION : AIR_FRICTION;
        // Stop completely if very slow
        if (Math.abs(velocity.x) < 0.01) velocity.x = 0;
    }

    // Jump
    if ((keys['Space'] || keys['KeyW'] || keys['ArrowUp']) && isOnGround) {
        velocity.y = JUMP_FORCE;
        isOnGround = false;
    }

    // Apply gravity
    velocity.y += GRAVITY;

    // Terminal velocity
    velocity.y = Math.max(velocity.y, -0.5);

    // Update position with smooth interpolation
    player.position.x += velocity.x;
    player.position.y += velocity.y;

    // Clamp horizontal position
    const maxX = HORIZONTAL_RANGE + 2;
    player.position.x = Math.max(-maxX, Math.min(maxX, player.position.x));

    // Check collisions
    checkCollisions();

    // Smooth player rotation based on velocity
    const targetRotationZ = -velocity.x * 0.8;
    const targetRotationX = velocity.y * 0.4;
    player.rotation.z += (targetRotationZ - player.rotation.z) * 0.1;
    player.rotation.x += (targetRotationX - player.rotation.x) * 0.1;

    // Update score based on camera height (which always goes up)
    score = Math.floor(camera.position.y * 10);
    scoreElement.textContent = `Score: ${score}`;

    // Fade glow effect
    const glow = player.getObjectByName('playerGlow');
    if (glow && glow.material.opacity > 0.3) {
        glow.material.opacity -= 0.02;
    }

    // Check game over - player fell below camera view
    const deathLine = camera.position.y - 8;
    if (player.position.y < deathLine && !gameOverTriggered) {
        gameOver();
    }
}

function updateCamera(deltaTime) {
    // Camera moves constantly upward - this is the main challenge!
    // Speed increases gradually over time
    cameraScrollSpeed = Math.min(
        CAMERA_SCROLL_SPEED_INITIAL + gameTime * CAMERA_SCROLL_SPEED_INCREMENT,
        CAMERA_SCROLL_SPEED_MAX
    );

    camera.position.y += cameraScrollSpeed;
    camera.lookAt(0, camera.position.y - 1, 0);

    // Update background particles position
    const particles = scene.getObjectByName('backgroundParticles');
    if (particles) {
        particles.position.y = camera.position.y - 20;
    }

    // Update lights to follow camera
    scene.children.forEach(child => {
        if (child instanceof THREE.DirectionalLight) {
            child.position.y = camera.position.y + 20;
            child.target.position.y = camera.position.y;
        }
        if (child instanceof THREE.PointLight) {
            child.position.y = camera.position.y + (child.position.x < 0 ? 5 : 10);
        }
    });
}

function startGame() {
    // Reset game state
    score = 0;
    velocity = { x: 0, y: 0 };
    isOnGround = false;
    gameOverTriggered = false;
    cameraScrollSpeed = CAMERA_SCROLL_SPEED_INITIAL;
    gameTime = 0;
    keys = {};

    // Reset UI
    scoreElement.textContent = 'Score: 0';
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');

    // Clear and regenerate
    if (player) scene.remove(player);
    generatePlatforms();
    createPlayer();

    // Reset camera
    camera.position.set(0, 5, 14);

    gameRunning = true;
    lastTime = performance.now();
    animate();
}

async function gameOver() {
    gameOverTriggered = true;
    gameRunning = false;

    finalScoreElement.textContent = score;

    // Reload leaderboard to get latest data
    await loadLeaderboard();

    // Check if score qualifies for leaderboard (always allow saving if score > 0)
    const qualifies = cachedLeaderboard.length < MAX_LEADERBOARD_ENTRIES ||
                      score > (cachedLeaderboard[cachedLeaderboard.length - 1]?.score || 0);

    if (qualifies && score > 0) {
        newHighScoreDiv.classList.remove('hidden');
        saveScoreBtn.classList.remove('hidden');
        saveScoreBtn.disabled = false;
        saveScoreBtn.textContent = 'Ulozit skore';
        playerNameInput.value = '';
        playerNameInput.focus();
    } else {
        newHighScoreDiv.classList.add('hidden');
        saveScoreBtn.classList.add('hidden');
    }

    renderLeaderboard(gameOverLeaderboardList);
    gameOverScreen.classList.remove('hidden');
}

// Cache for leaderboard data
let cachedLeaderboard = [];

async function saveScore() {
    const name = playerNameInput.value.trim() || 'Anonymous';

    // Disable button while saving
    saveScoreBtn.disabled = true;
    saveScoreBtn.textContent = 'Ukladam...';

    try {
        const response = await fetch('/api/scores', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, score })
        });

        if (!response.ok) {
            throw new Error('Failed to save score');
        }

        newHighScoreDiv.classList.add('hidden');
        saveScoreBtn.classList.add('hidden');

        // Refresh leaderboard
        await loadLeaderboard();
        renderLeaderboard(leaderboardList);
        renderLeaderboard(gameOverLeaderboardList);
        updateHighScoreDisplay();
    } catch (error) {
        console.error('Error saving score:', error);
        alert('Chyba pri ukladani skore. Zkus to znovu.');
        saveScoreBtn.disabled = false;
        saveScoreBtn.textContent = 'Ulozit skore';
    }
}

async function loadLeaderboard() {
    try {
        const response = await fetch('/api/scores');
        if (!response.ok) {
            throw new Error('Failed to load scores');
        }
        const data = await response.json();
        cachedLeaderboard = data.scores || [];
    } catch (error) {
        console.error('Error loading leaderboard:', error);
        cachedLeaderboard = [];
    }
}

function renderLeaderboard(listElement = leaderboardList) {
    if (cachedLeaderboard.length === 0) {
        listElement.innerHTML = '<li class="no-scores">Zatim zadne skore</li>';
        return;
    }

    listElement.innerHTML = cachedLeaderboard.map((entry, index) => `
        <li>
            <span class="rank">#${index + 1}</span>
            <span class="player-name">${escapeHtml(entry.name)}</span>
            <span class="player-score">${entry.score}</span>
        </li>
    `).join('');
}

function updateHighScoreDisplay() {
    if (cachedLeaderboard.length > 0) {
        highScoreElement.textContent = `Best: ${cachedLeaderboard[0].score}`;
    }
}

async function updateLeaderboardDisplay(listElement = leaderboardList) {
    await loadLeaderboard();
    renderLeaderboard(listElement);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

let lastTime = 0;
function animate(currentTime = 0) {
    if (!gameRunning) return;

    requestAnimationFrame(animate);

    const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.1); // Cap delta time
    lastTime = currentTime;
    gameTime += deltaTime;

    updatePlayer(deltaTime);
    updateCamera(deltaTime);
    addNewPlatforms();

    renderer.render(scene, camera);
}

// Initialize the game
init();
