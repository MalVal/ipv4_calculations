// ============================================================================
// DOM ELEMENTS
// ============================================================================

const ipAddressInput = document.getElementById('ipAddress');
const subnetMaskInput = document.getElementById('subnetMask');
const calculateBtn = document.getElementById('calculateBtn');
const resultDiv = document.getElementById('result');

// ============================================================================
// MAIN CALCULATION FUNCTION
// ============================================================================

/**
 * Main function called when the calculate button is clicked
 * Validates inputs, performs all calculations, and displays results
 */
calculateBtn.addEventListener('click', function() {
    // Get and validate user inputs
    const ipAddress = ipAddressInput.value.trim();
    let subnetMask = subnetMaskInput.value.trim();
    
    // Validate that both fields are filled
    if (!validateInputsNotEmpty(ipAddress, subnetMask)) {
        return;
    }
    
    // Validate IP address format
    if (!isValidIP(ipAddress)) {
        showResult('⚠️ ERROR: Invalid IP address format!', 'error');
        return;
    }
    
    // Convert CIDR notation to dotted decimal if needed (e.g., /24 -> 255.255.255.0)
    subnetMask = convertCidrIfNeeded(subnetMask);
    if (subnetMask === null) {
        return;
    }
    
    // Validate subnet mask format
    if (!isValidMask(subnetMask)) {
        showResult('⚠️ ERROR: Invalid subnet mask format!', 'error');
        return;
    }

    // Convert IP and mask to byte arrays
    const ipAddressBytes = convertToBytes(ipAddress);
    const subnetMaskBytes = convertToBytes(subnetMask);

    // Perform all network calculations
    const calculations = performNetworkCalculations(ipAddressBytes, subnetMaskBytes);

    // Display results in console and on screen
    displayResultsInConsole(ipAddress, subnetMask, calculations);
    displayResultsOnScreen(ipAddress, subnetMask, calculations);
});

// ============================================================================
// INPUT VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validates that both input fields are not empty
 * @param {string} ipAddress - The IP address input
 * @param {string} subnetMask - The subnet mask input
 * @returns {boolean} True if both fields are filled, false otherwise
 */
function validateInputsNotEmpty(ipAddress, subnetMask) {
    if (ipAddress === '' || subnetMask === '') {
        showResult('⚠️ ERROR: Please fill in all fields!', 'error');
        return false;
    }
    return true;
}

/**
 * Validates IP address format (xxx.xxx.xxx.xxx where xxx is 0-255)
 * @param {string} ip - The IP address to validate
 * @returns {boolean} True if valid, false otherwise
 */
function isValidIP(ip) {
    const ipPattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = ip.match(ipPattern);
    if (!match) return false;
    
    // Check that each octet is between 0 and 255
    for (let i = 1; i <= 4; i++) {
        const octet = parseInt(match[i]);
        if (octet < 0 || octet > 255) {
            return false;
        }
    }
    return true;
}

/**
 * Validates subnet mask format
 * Ensures mask has continuous 1s followed by continuous 0s in binary
 * @param {string} mask - The subnet mask to validate
 * @returns {boolean} True if valid, false otherwise
 */
function isValidMask(mask) {
    const maskPattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = mask.match(maskPattern);
    if (!match) return false;
    
    // Convert mask to binary string
    let binaryStr = "";
    for (let i = 1; i <= 4; i++) {
        const octet = parseInt(match[i], 10);
        if (octet < 0 || octet > 255) return false;
        let bin = octet.toString(2).padStart(8, "0");
        binaryStr += bin;
    }
    
    // Check that all 0s come after all 1s
    const firstZero = binaryStr.indexOf("0");
    if (firstZero === -1) return true; // All 1s is valid
    const rest = binaryStr.slice(firstZero);
    return !rest.includes("1"); // No 1s should appear after first 0
}

/**
 * Converts CIDR notation to dotted decimal if input starts with /
 * @param {string} subnetMask - The subnet mask (either /XX or xxx.xxx.xxx.xxx)
 * @returns {string|null} The dotted decimal mask, or null if invalid
 */
function convertCidrIfNeeded(subnetMask) {
    if (subnetMask.startsWith('/')) {
        const cidr = parseInt(subnetMask.substring(1));
        if (cidr < 0 || cidr > 32 || isNaN(cidr)) {
            showResult('⚠️ ERROR: Invalid CIDR notation! Use /0 to /32', 'error');
            return null;
        }
        return cidrToMask(cidr);
    }
    return subnetMask;
}

// ============================================================================
// CONVERSION FUNCTIONS
// ============================================================================

/**
 * Converts dotted decimal IP/mask to array of integers
 * @param {string} address - The IP address or mask (xxx.xxx.xxx.xxx)
 * @returns {number[]} Array of 4 integers (0-255)
 */
function convertToBytes(address) {
    const bytes = address.split(".");
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(bytes[i]);
    }
    return bytes;
}

/**
 * Converts CIDR notation to dotted decimal subnet mask
 * @param {number} cidr - The CIDR value (0-32)
 * @returns {string} The subnet mask in dotted decimal notation
 */
function cidrToMask(cidr) {
    if (cidr < 0 || cidr > 32) return null;
    let maskBytes = [];
    
    for (let i = 0; i < 4; i++) {
        if (cidr >= 8) {
            maskBytes.push(255);
            cidr -= 8;
        } else {
            let byte = 0;
            for (let j = 7; j >= 8 - cidr; j--) {
                byte += 1 << j;
            }
            maskBytes.push(byte);
            cidr = 0;
        }
    }
    return maskBytes.join(".");
}

/**
 * Converts dotted decimal subnet mask to CIDR notation
 * @param {string} mask - The subnet mask (xxx.xxx.xxx.xxx)
 * @returns {number} The CIDR value (0-32)
 */
function maskToCidr(mask) {
    let parts = mask.split(".");
    if (parts.length !== 4) return null;
    
    let cidr = 0;
    let zeroFound = false;
    
    for (let part of parts) {
        let byte = parseInt(part, 10);
        if (byte < 0 || byte > 255) return null;
        
        for (let i = 7; i >= 0; i--) {
            let bit = (byte >> i) & 1;
            if (bit === 1) {
                if (zeroFound) return null;
                cidr++;
            } else {
                zeroFound = true;
            }
        }
    }
    return cidr;
}

// ============================================================================
// NETWORK CALCULATION FUNCTIONS
// ============================================================================

/**
 * Performs all network calculations
 * @param {number[]} ipBytes - IP address as byte array
 * @param {number[]} maskBytes - Subnet mask as byte array
 * @returns {object} Object containing all calculation results
 */
function performNetworkCalculations(ipBytes, maskBytes) {
    const networkBytes = calculateNetworkAddress(ipBytes, maskBytes);
    const broadcastBytes = calculateBroadcastAddress(networkBytes, maskBytes);
    const cidr = maskToCidr(maskBytes.join("."));
    const defaultCidr = getDefaultCidr(ipBytes[0]);
    
    return {
        networkAddress: networkBytes.join("."),
        broadcastAddress: broadcastBytes.join("."),
        firstUsable: calculateFirstUsableAddress(networkBytes, cidr),
        lastUsable: calculateLastUsableAddress(broadcastBytes, cidr),
        availableHosts: calculateAvailableHosts(cidr),
        subnetNumber: calculateSubnetNumber(ipBytes, cidr, defaultCidr),
        hostNumber: calculateHostNumber(ipBytes, cidr),
        totalSubnets: calculateTotalSubnets(cidr, defaultCidr),
        cidr: cidr
    };
}

/**
 * Calculates the network address by ANDing IP with subnet mask
 * @param {number[]} ipBytes - IP address as byte array
 * @param {number[]} maskBytes - Subnet mask as byte array
 * @returns {number[]} Network address as byte array
 */
function calculateNetworkAddress(ipBytes, maskBytes) {
    let networkBytes = [];
    for (let i = 0; i < ipBytes.length; i++) {
        networkBytes.push(ipBytes[i] & maskBytes[i]);
    }
    return networkBytes;
}

/**
 * Calculates the broadcast address by ORing network address with inverted mask
 * @param {number[]} networkBytes - Network address as byte array
 * @param {number[]} maskBytes - Subnet mask as byte array
 * @returns {number[]} Broadcast address as byte array
 */
function calculateBroadcastAddress(networkBytes, maskBytes) {
    let broadcastBytes = [];
    for (let i = 0; i < networkBytes.length; i++) {
        let hostBits = ~maskBytes[i] & 0xFF;  // Invert mask and keep only 8 bits
        broadcastBytes.push(networkBytes[i] | hostBits);
    }
    return broadcastBytes;
}

/**
 * Calculates the first usable host address (network address + 1)
 * @param {number[]} networkBytes - Network address as byte array
 * @param {number} cidr - CIDR notation value
 * @returns {string} First usable address or message if none available
 */
function calculateFirstUsableAddress(networkBytes, cidr) {
    if (cidr >= 31) {
        return "No available address";
    }
    
    let firstBytes = [...networkBytes];
    
    // Add 1 to the network address
    for (let i = 3; i >= 0; i--) {
        if (firstBytes[i] < 255) {
            firstBytes[i]++;
            break;
        } else {
            firstBytes[i] = 0;
        }
    }
    
    return firstBytes.join(".");
}

/**
 * Calculates the last usable host address (broadcast address - 1)
 * @param {number[]} broadcastBytes - Broadcast address as byte array
 * @param {number} cidr - CIDR notation value
 * @returns {string} Last usable address or message if none available
 */
function calculateLastUsableAddress(broadcastBytes, cidr) {
    if (cidr >= 31) {
        return "No available address";
    }
    
    let lastBytes = [...broadcastBytes];
    
    // Subtract 1 from the broadcast address
    for (let i = 3; i >= 0; i--) {
        if (lastBytes[i] > 0) {
            lastBytes[i]--;
            break;
        } else {
            lastBytes[i] = 255;
        }
    }
    
    return lastBytes.join(".");
}

/**
 * Calculates the number of available host addresses
 * @param {number} cidr - CIDR notation value
 * @returns {number} Number of available hosts
 */
function calculateAvailableHosts(cidr) {
    if (cidr >= 32) return "No available subnet";
    if (cidr === 31) return 2; // Point-to-point links (RFC 3021)
    return Math.pow(2, 32 - cidr) - 2; // Subtract network and broadcast addresses
}

/**
 * Gets the default CIDR based on IP address class
 * @param {number} firstOctet - First octet of the IP address
 * @returns {number} Default CIDR for the IP class (8, 16, 24, or 0)
 */
function getDefaultCidr(firstOctet) {
    if (firstOctet >= 1 && firstOctet <= 126) {
        return 8;  // Class A
    } else if (firstOctet >= 128 && firstOctet <= 191) {
        return 16; // Class B
    } else if (firstOctet >= 192 && firstOctet <= 223) {
        return 24; // Class C
    }
    return 0; // Class D/E or invalid
}

/**
 * Calculates the subnet number (which subnet we're in)
 * @param {number[]} ipBytes - IP address as byte array
 * @param {number} cidr - Current CIDR notation
 * @param {number} defaultCidr - Default CIDR for the IP class
 * @returns {number} Subnet number
 */
function calculateSubnetNumber(ipBytes, cidr, defaultCidr) {
    // If no subnetting occurred, we're in subnet 0
    if (cidr <= defaultCidr) {
        return 0;
    }
    
    // Extract subnet bits (bits between defaultCidr and cidr)
    let subnetBits = 0;
    let bitPosition = 0;
    
    for (let i = 0; i < 4; i++) {
        for (let bit = 7; bit >= 0; bit--) {
            // Only examine bits in the subnet portion
            if (bitPosition >= defaultCidr && bitPosition < cidr) {
                let ipBit = (ipBytes[i] >> bit) & 1;
                subnetBits = (subnetBits << 1) | ipBit;
            }
            bitPosition++;
        }
    }
    
    return subnetBits;
}

/**
 * Calculates the host number within the subnet
 * @param {number[]} ipBytes - IP address as byte array
 * @param {number[]} networkBytes - Network address as byte array
 * @param {number} cidr - CIDR notation value
 * @returns {number} Host number within the subnet
 */
function calculateHostNumber(ipBytes, cidr) {
    // If /32 or /31, there's no host portion
    if (cidr >= 31) {
        return 0;
    }
    
    // Extract host bits (bits after cidr position)
    let hostNumber = 0;
    let bitPosition = 0;
    
    for (let i = 0; i < 4; i++) {
        for (let bit = 7; bit >= 0; bit--) {
            // Only examine bits in the host portion
            if (bitPosition >= cidr) {
                let ipBit = (ipBytes[i] >> bit) & 1;
                hostNumber = (hostNumber << 1) | ipBit;
            }
            bitPosition++;
        }
    }
    
    return hostNumber;
}

/**
 * Calculates the total number of subnets created
 * @param {number} cidr - Current CIDR notation
 * @param {number} defaultCidr - Default CIDR for the IP class
 * @returns {number} Total number of subnets
 */
function calculateTotalSubnets(cidr, defaultCidr) {
    // If no subnetting, there's only 1 network (the original)
    if (cidr <= defaultCidr) {
        return 1;
    }
    
    // Calculate number of subnet bits borrowed
    let subnetBits = cidr - defaultCidr;
    
    // Total subnets = 2^(number of subnet bits)
    return Math.pow(2, subnetBits);
}

// ============================================================================
// DISPLAY FUNCTIONS
// ============================================================================

/**
 * Displays results in the browser console
 * @param {string} ipAddress - Original IP address input
 * @param {string} subnetMask - Subnet mask in dotted decimal
 * @param {object} calc - Calculation results object
 */
function displayResultsInConsole(ipAddress, subnetMask, calc) {
    console.log('IP Address:', ipAddress);
    console.log('Subnet Mask:', subnetMask);
    console.log("Network Address:", calc.networkAddress + "/" + calc.cidr);
    console.log("Broadcast Address:", calc.broadcastAddress);
    console.log("First usable Address:", calc.firstUsable);
    console.log("Last usable Address:", calc.lastUsable);
    console.log("Total available hosts:", calc.availableHosts);
    console.log("Host Number:", calc.hostNumber);
    console.log("Total available Subnets:", calc.totalSubnets);
    console.log("Subnet Number:", calc.subnetNumber);
}

/**
 * Displays results in a table on the web page
 * @param {string} ipAddress - Original IP address input
 * @param {string} subnetMask - Subnet mask in dotted decimal
 * @param {object} calc - Calculation results object
 */
function displayResultsOnScreen(ipAddress, subnetMask, calc) {
    showResult(`
        <table class="result-table">
            <tr>
                <td class="label">IP Address:</td>
                <td class="value">${ipAddress}</td>
            </tr>
            <tr>
                <td class="label">Subnet Mask:</td>
                <td class="value">${subnetMask} (/${calc.cidr})</td>
            </tr>
            <tr>
                <td class="label">Network Address:</td>
                <td class="value">${calc.networkAddress}/${calc.cidr}</td>
            </tr>
            <tr>
                <td class="label">Broadcast Address:</td>
                <td class="value">${calc.broadcastAddress}</td>
            </tr>
            <tr>
                <td class="label">First Usable:</td>
                <td class="value">${calc.firstUsable}</td>
            </tr>
            <tr>
                <td class="label">Last Usable:</td>
                <td class="value">${calc.lastUsable}</td>
            </tr>
            <tr>
                <td class="label">Total of Hosts:</td>
                <td class="value">${calc.availableHosts}</td>
            </tr>
            <tr>
                <td class="label">Host Number:</td>
                <td class="value">${calc.hostNumber}</td>
            </tr>
            <tr>
                <td class="label">Total of Subnets:</td>
                <td class="value">${calc.totalSubnets}</td>
            </tr>
            <tr>
                <td class="label">Subnet Number:</td>
                <td class="value">${calc.subnetNumber}</td>
            </tr>
        </table>
    `, 'success');
}

/**
 * Displays a message in the result div
 * @param {string} message - The message to display (can contain HTML)
 * @param {string} type - Message type ('error' or 'success')
 */
function showResult(message, type) {
    resultDiv.innerHTML = message;
    resultDiv.style.color = type === 'error' ? '#ff0000' : '#00ff00';
    resultDiv.style.textShadow = type === 'error' 
        ? '0 0 10px #ff0000' 
        : '0 0 10px #00ff00';
    resultDiv.classList.add('show');
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

/**
 * Allow calculation when pressing Enter in IP address field
 */
ipAddressInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        calculateBtn.click();
    }
});

/**
 * Allow calculation when pressing Enter in subnet mask field
 */
subnetMaskInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        calculateBtn.click();
    }
});

// ============================================================================
// INITIALIZATION
// ============================================================================

// Display welcome message in console
console.log('%c=== IP CALCULATOR ===', 'color: #00ff00; font-size: 20px; font-weight: bold;');
console.log('%cReady to receive your network data...', 'color: #00ffff; font-size: 14px;');