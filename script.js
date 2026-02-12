// ============================================================================
// DOM ELEMENTS
// ============================================================================

const ipAddressInput = document.getElementById('ipAddress');
const subnetMaskInput = document.getElementById('subnetMask');
const calculateBtn   = document.getElementById('calculateBtn');
const resultDiv      = document.getElementById('result');

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

/**
 * Called on button click — validates inputs, runs calculations, renders results.
 */
calculateBtn.addEventListener('click', function () {
    const ipAddress  = ipAddressInput.value.trim();
    let   subnetMask = subnetMaskInput.value.trim();

    if (!validateInputsNotEmpty(ipAddress, subnetMask)) return;

    if (!isValidIP(ipAddress)) {
        showError('⚠️ ERROR: Invalid IP address format!');
        return;
    }

    subnetMask = convertCidrIfNeeded(subnetMask);
    if (subnetMask === null) return;

    if (!isValidMask(subnetMask)) {
        showError('⚠️ ERROR: Invalid subnet mask format!');
        return;
    }

    const ipBytes   = convertToBytes(ipAddress);
    const maskBytes = convertToBytes(subnetMask);
    const calc      = performNetworkCalculations(ipBytes, maskBytes);

    displayResultsInConsole(ipAddress, subnetMask, calc);
    displayResultsOnScreen(ipAddress, subnetMask, calc);
});

// ============================================================================
// INPUT VALIDATION
// ============================================================================

/**
 * Checks both fields are non-empty.
 * @param {string} ip   - IP address string
 * @param {string} mask - Subnet mask string
 * @returns {boolean}
 */
function validateInputsNotEmpty(ip, mask) {
    if (ip === '' || mask === '') {
        showError('⚠️ ERROR: Please fill in all fields!');
        return false;
    }
    return true;
}

/**
 * Validates dotted-decimal IP address (4 octets, each 0-255).
 * @param {string} ip
 * @returns {boolean}
 */
function isValidIP(ip) {
    const match = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!match) return false;
    for (let i = 1; i <= 4; i++) {
        if (parseInt(match[i]) > 255) return false;
    }
    return true;
}

/**
 * Validates a subnet mask: binary must be continuous 1s then continuous 0s.
 * @param {string} mask
 * @returns {boolean}
 */
function isValidMask(mask) {
    const match = mask.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!match) return false;

    let bin = '';
    for (let i = 1; i <= 4; i++) {
        const oct = parseInt(match[i]);
        if (oct > 255) return false;
        bin += oct.toString(2).padStart(8, '0');
    }

    const firstZero = bin.indexOf('0');
    return firstZero === -1 || !bin.slice(firstZero).includes('1');
}

/**
 * If mask starts with '/', converts CIDR to dotted decimal.
 * @param {string} mask
 * @returns {string|null}  null on error
 */
function convertCidrIfNeeded(mask) {
    if (!mask.startsWith('/')) return mask;
    const cidr = parseInt(mask.substring(1));
    if (isNaN(cidr) || cidr < 0 || cidr > 32) {
        showError('⚠️ ERROR: Invalid CIDR notation! Use /0 to /32');
        return null;
    }
    return cidrToMask(cidr);
}

// ============================================================================
// CONVERSION HELPERS
// ============================================================================

/**
 * Splits dotted-decimal address into array of integers.
 * @param {string} address
 * @returns {number[]}
 */
function convertToBytes(address) {
    return address.split('.').map(Number);
}

/**
 * Converts CIDR value to dotted-decimal subnet mask.
 * @param {number} cidr  (0-32)
 * @returns {string}
 */
function cidrToMask(cidr) {
    const bytes = [];
    for (let i = 0; i < 4; i++) {
        if (cidr >= 8) {
            bytes.push(255);
            cidr -= 8;
        } else {
            let byte = 0;
            for (let j = 7; j >= 8 - cidr; j--) byte += (1 << j);
            bytes.push(byte);
            cidr = 0;
        }
    }
    return bytes.join('.');
}

/**
 * Converts dotted-decimal subnet mask to CIDR value.
 * @param {string} mask
 * @returns {number}
 */
function maskToCidr(mask) {
    let cidr = 0, zeroFound = false;
    for (const part of mask.split('.')) {
        const byte = parseInt(part);
        for (let i = 7; i >= 0; i--) {
            if ((byte >> i) & 1) {
                if (zeroFound) return null;
                cidr++;
            } else {
                zeroFound = true;
            }
        }
    }
    return cidr;
}

/**
 * Converts a byte array to dotted-decimal string.
 * @param {number[]} bytes
 * @returns {string}
 */
function bytesToDotted(bytes) {
    return bytes.join('.');
}

// ============================================================================
// NETWORK CALCULATIONS
// ============================================================================

/**
 * Runs all calculations and returns a single result object.
 * @param {number[]} ipBytes
 * @param {number[]} maskBytes
 * @returns {object}
 */
function performNetworkCalculations(ipBytes, maskBytes) {
    const networkBytes   = calculateNetworkAddress(ipBytes, maskBytes);
    const broadcastBytes = calculateBroadcastAddress(networkBytes, maskBytes);
    const cidr           = maskToCidr(bytesToDotted(maskBytes));
    const defaultCidr    = getDefaultCidr(ipBytes[0]);
    const wildcardBytes  = maskBytes.map(b => (~b) & 0xFF);

    return {
        cidr,
        defaultCidr,
        networkAddress   : bytesToDotted(networkBytes),
        broadcastAddress : bytesToDotted(broadcastBytes),
        wildcardMask     : bytesToDotted(wildcardBytes),
        firstUsable      : calculateFirstUsableAddress(networkBytes, cidr),
        lastUsable       : calculateLastUsableAddress(broadcastBytes, cidr),
        availableHosts   : calculateAvailableHosts(cidr),
        ipClass          : getIPClass(ipBytes[0]),
        ipType           : getIPType(ipBytes),
        subnetNumber     : calculateSubnetNumber(ipBytes, cidr, defaultCidr),
        hostNumber       : calculateHostNumber(ipBytes, cidr),
        totalSubnets     : calculateTotalSubnets(cidr, defaultCidr),
        networkBytes,
        broadcastBytes,
        ipBytes,
        maskBytes,
        wildcardBytes,
    };
}

/**
 * Network address = IP AND mask.
 * @param {number[]} ipBytes
 * @param {number[]} maskBytes
 * @returns {number[]}
 */
function calculateNetworkAddress(ipBytes, maskBytes) {
    return ipBytes.map((b, i) => b & maskBytes[i]);
}

/**
 * Broadcast address = network OR ~mask (wildcard).
 * @param {number[]} networkBytes
 * @param {number[]} maskBytes
 * @returns {number[]}
 */
function calculateBroadcastAddress(networkBytes, maskBytes) {
    return networkBytes.map((b, i) => b | ((~maskBytes[i]) & 0xFF));
}

/**
 * First usable host = network + 1  (N/A for /31 and /32).
 * @param {number[]} networkBytes
 * @param {number}   cidr
 * @returns {string}
 */
function calculateFirstUsableAddress(networkBytes, cidr) {
    if (cidr >= 31) return 'N/A';
    const bytes = [...networkBytes];
    for (let i = 3; i >= 0; i--) {
        if (bytes[i] < 255) { bytes[i]++; break; }
        else bytes[i] = 0;
    }
    return bytesToDotted(bytes);
}

/**
 * Last usable host = broadcast - 1  (N/A for /31 and /32).
 * @param {number[]} broadcastBytes
 * @param {number}   cidr
 * @returns {string}
 */
function calculateLastUsableAddress(broadcastBytes, cidr) {
    if (cidr >= 31) return 'N/A';
    const bytes = [...broadcastBytes];
    for (let i = 3; i >= 0; i--) {
        if (bytes[i] > 0) { bytes[i]--; break; }
        else bytes[i] = 255;
    }
    return bytesToDotted(bytes);
}

/**
 * Available host count = 2^(32-cidr) - 2.
 * Special cases for /31 (2) and /32 (0).
 * @param {number} cidr
 * @returns {number|string}
 */
function calculateAvailableHosts(cidr) {
    if (cidr >= 32) return 0;
    if (cidr === 31) return 2;   // RFC 3021 point-to-point
    return Math.pow(2, 32 - cidr) - 2;
}

/**
 * Returns the classful default CIDR for an IP address.
 * @param {number} firstOctet
 * @returns {number}  8 | 16 | 24 | 0
 */
function getDefaultCidr(firstOctet) {
    if (firstOctet >= 1   && firstOctet <= 126) return 8;   // Class A
    if (firstOctet >= 128 && firstOctet <= 191) return 16;  // Class B
    if (firstOctet >= 192 && firstOctet <= 223) return 24;  // Class C
    return 0;
}

/**
 * Returns the IP address class letter.
 * @param {number} firstOctet
 * @returns {string}
 */
function getIPClass(firstOctet) {
    if (firstOctet >= 1   && firstOctet <= 126) return 'A';
    if (firstOctet === 127)                      return 'Loopback';
    if (firstOctet >= 128 && firstOctet <= 191) return 'B';
    if (firstOctet >= 192 && firstOctet <= 223) return 'C';
    if (firstOctet >= 224 && firstOctet <= 239) return 'D';
    return 'E';
}

/**
 * Returns the IP address type (Private, Public, Loopback, etc.).
 * @param {number[]} ipBytes
 * @returns {string}
 */
function getIPType(ipBytes) {
    const [a, b] = ipBytes;
    if (a === 10)                           return 'Private (RFC 1918)';
    if (a === 172 && b >= 16 && b <= 31)   return 'Private (RFC 1918)';
    if (a === 192 && b === 168)             return 'Private (RFC 1918)';
    if (a === 127)                          return 'Loopback';
    if (a === 169 && b === 254)             return 'Link-local (APIPA)';
    if (a >= 224 && a <= 239)               return 'Multicast';
    if (a === 0)                            return 'This network (reserved)';
    if (a === 255)                          return 'Broadcast (reserved)';
    return 'Public';
}

/**
 * Subnet number = value of the subnet bits (bits between defaultCidr and cidr).
 * @param {number[]} ipBytes
 * @param {number}   cidr
 * @param {number}   defaultCidr
 * @returns {number}
 */
function calculateSubnetNumber(ipBytes, cidr, defaultCidr) {
    if (cidr <= defaultCidr) return 0;
    let result = 0, pos = 0;
    for (let i = 0; i < 4; i++) {
        for (let bit = 7; bit >= 0; bit--) {
            if (pos >= defaultCidr && pos < cidr) {
                result = (result << 1) | ((ipBytes[i] >> bit) & 1);
            }
            pos++;
        }
    }
    return result + 1;
}

/**
 * Host number = value of the host bits (bits after cidr position).
 * @param {number[]} ipBytes
 * @param {number}   cidr
 * @returns {number}
 */
function calculateHostNumber(ipBytes, cidr) {
    if (cidr >= 32) return 0;
    let result = 0, pos = 0;
    for (let i = 0; i < 4; i++) {
        for (let bit = 7; bit >= 0; bit--) {
            if (pos >= cidr) {
                result = (result << 1) | ((ipBytes[i] >> bit) & 1);
            }
            pos++;
        }
    }
    return result;
}

/**
 * Total subnets = 2^(cidr - defaultCidr).
 * @param {number} cidr
 * @param {number} defaultCidr
 * @returns {number}
 */
function calculateTotalSubnets(cidr, defaultCidr) {
    if (cidr <= defaultCidr) return 1;
    return Math.pow(2, cidr - defaultCidr);
}

// ============================================================================
// BINARY DISPLAY HELPERS
// ============================================================================

/**
 * Returns colored HTML for a single byte's bits, given the bit ranges for
 * network, subnet, and host portions.
 * @param {number} byte         - The byte value
 * @param {number} byteIndex    - 0-3
 * @param {number} cidr         - Total mask length
 * @param {number} defaultCidr  - Classful default mask length
 * @returns {string}  HTML string
 */
function renderByteBits(byte, byteIndex, cidr, defaultCidr) {
    let html = '';
    for (let bit = 7; bit >= 0; bit--) {
        const pos   = byteIndex * 8 + (7 - bit);
        const value = (byte >> bit) & 1;
        let cls;
        if (pos < defaultCidr)      cls = 'bit-network';
        else if (pos < cidr)        cls = 'bit-subnet';
        else                        cls = 'bit-host';
        html += `<span class="${cls}">${value}</span>`;
    }
    return html;
}

/**
 * Builds a full 32-bit binary HTML row for an address.
 * @param {number[]} bytes
 * @param {number}   cidr
 * @param {number}   defaultCidr
 * @returns {string}
 */
function renderBinaryAddress(bytes, cidr, defaultCidr) {
    return bytes
        .map((b, i) => `<span class="binary-block">${renderByteBits(b, i, cidr, defaultCidr)}</span>`)
        .join('<span class="bit-sep">.</span>');
}

// ============================================================================
// SUBNET LIST HELPER
// ============================================================================

/**
 * Returns HTML for a list of the first N subnets in the network,
 * highlighting the current one.
 * @param {number[]} networkBytes
 * @param {number[]} maskBytes
 * @param {number}   subnetNumber  - Which subnet we're in (0-based)
 * @param {number}   totalSubnets
 * @returns {string}
 */
function renderSubnetList(networkBytes, maskBytes, subnetNumber, totalSubnets, cidr) {
    const MAX_SHOW = 8;

    // Size of one subnet block = 2^(32-cidr)
    const blockSize = Math.pow(2, 32 - cidr);

    // Convert network address to a 32-bit integer
    let baseInt = (networkBytes[0] << 24 | networkBytes[1] << 16 |
                   networkBytes[2] << 8  | networkBytes[3]) >>> 0;

    // Rewind to the first subnet of this class network
    // (i.e., set all subnet+host bits to 0)
    const defaultCidr = getDefaultCidr(networkBytes[0]);
    const maskInt     = (maskBytes[0] << 24 | maskBytes[1] << 16 |
                         maskBytes[2] << 8  | maskBytes[3]) >>> 0;

    // First subnet of the class network
    const classNetworkInt = baseInt & (0xFFFFFFFF << (32 - defaultCidr)) >>> 0;

    let html = '<div class="subnet-list">';

    const showCount = Math.min(totalSubnets, MAX_SHOW);
    for (let s = 0; s < showCount; s++) {
        const netInt  = (classNetworkInt + s * blockSize) >>> 0;
        const bcastInt = (netInt + blockSize - 1) >>> 0;

        const netStr   = intToIp(netInt);
        const bcastStr = intToIp(bcastInt);
        const isCurrent = (s === subnetNumber);

        html += `<div class="subnet-list-row${isCurrent ? ' current' : ''}">
            <span class="sn-num">#${s}</span>
            <span>${netStr}/${cidr}</span>
            <span>→ ${bcastStr}</span>
        </div>`;
    }

    if (totalSubnets > MAX_SHOW) {
        html += `<div class="subnet-more">... and ${totalSubnets - MAX_SHOW} more subnets</div>`;
    }

    html += '</div>';
    return html;
}

/**
 * Converts a 32-bit integer to dotted-decimal IP string.
 * @param {number} int
 * @returns {string}
 */
function intToIp(int) {
    return [
        (int >>> 24) & 0xFF,
        (int >>> 16) & 0xFF,
        (int >>>  8) & 0xFF,
         int         & 0xFF
    ].join('.');
}

// ============================================================================
// DISPLAY FUNCTIONS
// ============================================================================

/**
 * Logs all results to the browser console.
 */
function displayResultsInConsole(ipAddress, subnetMask, c) {
    console.log('=== IP CALCULATOR RESULTS ===');
    console.log('IP Address:       ', ipAddress);
    console.log('Subnet Mask:      ', subnetMask, `(/${c.cidr})`);
    console.log('IP Class:         ', c.ipClass);
    console.log('IP Type:          ', c.ipType);
    console.log('Network Address:  ', c.networkAddress + '/' + c.cidr);
    console.log('Broadcast Address:', c.broadcastAddress);
    console.log('Wildcard Mask:    ', c.wildcardMask);
    console.log('First Usable:     ', c.firstUsable);
    console.log('Last Usable:      ', c.lastUsable);
    console.log('Available Hosts:  ', c.availableHosts);
    console.log('Host Number:      ', c.hostNumber);
    console.log('Subnet Number:    ', c.subnetNumber);
    console.log('Total Subnets:    ', c.totalSubnets);
}

/**
 * Renders the full result panel on screen.
 */
function displayResultsOnScreen(ipAddress, subnetMask, c) {
    const binaryIP      = renderBinaryAddress(c.ipBytes,      c.cidr, c.defaultCidr);
    const binaryMask    = renderBinaryAddress(c.maskBytes,    c.cidr, c.defaultCidr);
    const binaryWild    = renderBinaryAddress(c.wildcardBytes, c.cidr, c.defaultCidr);
    const binaryNetwork = renderBinaryAddress(c.networkBytes, c.cidr, c.defaultCidr);
    const subnetListHTML = renderSubnetList(
        c.networkBytes, c.maskBytes, c.subnetNumber, c.totalSubnets, c.cidr
    );

    const ipTypeBadgeColor = c.ipType.includes('Private') ? '#00ff00'
                           : c.ipType === 'Loopback'       ? '#00ffff'
                           : c.ipType === 'Multicast'      ? '#ffaa00'
                           : '#ffffff';

    // Force reflow to restart the flicker animation

    resultDiv.innerHTML = `

        <!-- SECTION 1 : Address Info -->
        <div class="result-section">
            <div class="result-section-title">▶ ADDRESS INFO</div>
            <table class="result-table">
                <tr>
                    <td class="label">IP Address:</td>
                    <td class="value highlight">${ipAddress}</td>
                </tr>
                <tr>
                    <td class="label">Subnet Mask:</td>
                    <td class="value">${subnetMask} <span style="color:#555"> </span> /${c.cidr}</td>
                </tr>
                <tr>
                    <td class="label">Wildcard Mask:</td>
                    <td class="value cyan">${c.wildcardMask}</td>
                </tr>
                <tr>
                    <td class="label">IP Class:</td>
                    <td class="value">
                        <span class="ip-class-badge" style="color:#ffff00">CLASS ${c.ipClass}</span>
                    </td>
                </tr>
                <tr>
                    <td class="label">IP Type:</td>
                    <td class="value">
                        <span style="color:${ipTypeBadgeColor};text-shadow:0 0 4px ${ipTypeBadgeColor}">${c.ipType}</span>
                    </td>
                </tr>
            </table>
        </div>

        <!-- SECTION 2 : Network Range -->
        <div class="result-section">
            <div class="result-section-title">▶ NETWORK RANGE</div>
            <table class="result-table">
                <tr>
                    <td class="label">Network:</td>
                    <td class="value highlight">${c.networkAddress}/${c.cidr}</td>
                </tr>
                <tr>
                    <td class="label">Broadcast:</td>
                    <td class="value highlight">${c.broadcastAddress}</td>
                </tr>
                <tr>
                    <td class="label">First Usable:</td>
                    <td class="value">${c.firstUsable}</td>
                </tr>
                <tr>
                    <td class="label">Last Usable:</td>
                    <td class="value">${c.lastUsable}</td>
                </tr>
                <tr>
                    <td class="label">Available Hosts:</td>
                    <td class="value orange">${c.availableHosts.toLocaleString()}</td>
                </tr>
            </table>
        </div>

        <!-- SECTION 3 : Subnet Info -->
        <div class="result-section">
            <div class="result-section-title">▶ SUBNET INFO</div>
            <table class="result-table">
                <tr>
                    <td class="label">Host Number:</td>
                    <td class="value cyan">${c.hostNumber}</td>
                </tr>
                <tr>
                    <td class="label">Subnet Number:</td>
                    <td class="value cyan">${c.subnetNumber}</td>
                </tr>
                <tr>
                    <td class="label">Total Subnets:</td>
                    <td class="value orange">${c.totalSubnets}</td>
                </tr>
            </table>
        </div>

        <!-- SECTION 4 : Binary View -->
        <div class="result-section full-width">
            <div class="result-section-title">▶ BINARY VIEW</div>
            <div class="binary-legend">
                <span class="legend-item"><span class="legend-dot" style="background:#ff4444"></span><span class="bit-network">Network</span></span>
                <span class="legend-item"><span class="legend-dot" style="background:#ffaa00"></span><span class="bit-subnet">Subnet</span></span>
                <span class="legend-item"><span class="legend-dot" style="background:#00ff00"></span><span class="bit-host">Host</span></span>
            </div>
            <br>
            <div class="binary-row">
                <span class="label">IP&nbsp;&nbsp;&nbsp;&nbsp;:</span>${binaryIP}
            </div>
            <div class="binary-row">
                <span class="label">Mask&nbsp;&nbsp;:</span>${binaryMask}
            </div>
            <div class="binary-row">
                <span class="label">Wild&nbsp;&nbsp;:</span>${binaryWild}
            </div>
            <div class="binary-row">
                <span class="label">Net&nbsp;&nbsp;&nbsp;:</span>${binaryNetwork}
            </div>
        </div>

        <!-- SECTION 5 : Subnet List -->
        <div class="result-section full-width">
            <div class="result-section-title">▶ SUBNET LIST <span style="color:#555;font-size:0.85em"></span></div>
            ${subnetListHTML}
        </div>
    `;
    resultDiv.scrollTop = 0;

}

/**
 * Displays an error message in the result div.
 * @param {string} message
 */
function showError(message) {
    resultDiv.innerHTML = `<div class="error-msg">${message}</div>`;
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

ipAddressInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') calculateBtn.click();
});

subnetMaskInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') calculateBtn.click();
});

// ============================================================================
// INIT
// ============================================================================

console.log('%c=== IP CALCULATOR ===', 'color:#00ff00;font-size:20px;font-weight:bold');
console.log('%cReady to receive your network data...', 'color:#00ffff;font-size:14px');