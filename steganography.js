class Steganography {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
    }

    // Encrypt message with provided password
    encryptMessage(message, password) {
        return CryptoJS.AES.encrypt(message, password).toString();
    }

    // Decrypt message with provided password
    decryptMessage(encryptedMessage, password) {
        const decrypted = CryptoJS.AES.decrypt(encryptedMessage, password);
        return decrypted.toString(CryptoJS.enc.Utf8);
    }

    // Convert text to binary
    textToBinary(text) {
        return text.split('').map(char =>
            char.charCodeAt(0).toString(2).padStart(8, '0')
        ).join('');
    }

    // Convert binary to text
    binaryToText(binary) {
        const chunks = binary.match(/.{1,8}/g) || [];
        return chunks.map(chunk =>
            String.fromCharCode(parseInt(chunk, 2))
        ).join('');
    }

    // Encode message into image
    async encode(imageData, message, password) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                try {
                    // Encrypt the message with password
                    const encryptedMessage = this.encryptMessage(message, password);

                    // Continue with existing encoding process using encrypted message
                    this.canvas.width = img.width;
                    this.canvas.height = img.height;
                    this.ctx.drawImage(img, 0, 0);

                    const imgData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
                    const pixels = imgData.data;

                    const binary = this.textToBinary(encryptedMessage);
                    const messageLength = binary.length.toString(2).padStart(32, '0');
                    const fullBinary = messageLength + binary;

                    if (fullBinary.length > pixels.length * 3) {
                        reject('Image too small to store encrypted message');
                        return;
                    }

                    let binaryIndex = 0;
                    for (let i = 0; i < pixels.length && binaryIndex < fullBinary.length; i += 4) {
                        for (let j = 0; j < 3 && binaryIndex < fullBinary.length; j++) {
                            const bit = parseInt(fullBinary[binaryIndex]);
                            pixels[i + j] = (pixels[i + j] & 254) | bit;
                            binaryIndex++;
                        }
                    }

                    this.ctx.putImageData(imgData, 0, 0);
                    this.canvas.toBlob((blob) => {
                        resolve(blob);
                    }, 'image/png');
                } catch (error) {
                    reject('Encryption error: ' + error.message);
                }
            };

            img.onerror = () => {
                reject('Error loading image');
            };

            img.src = imageData;
        });
    }

    // Decode message from image
    async decode(imageData, password) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                try {
                    this.canvas.width = img.width;
                    this.canvas.height = img.height;
                    this.ctx.drawImage(img, 0, 0);

                    const imgData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
                    const pixels = imgData.data;

                    let binary = '';
                    for (let i = 0; i < pixels.length; i += 4) {
                        for (let j = 0; j < 3; j++) {
                            binary += pixels[i + j] & 1;
                        }
                    }

                    const messageLength = parseInt(binary.substr(0, 32), 2);
                    const messageBinary = binary.substr(32, messageLength);
                    const encryptedMessage = this.binaryToText(messageBinary);

                    // Decrypt the extracted message with password
                    const decryptedMessage = this.decryptMessage(encryptedMessage, password);
                    resolve(decryptedMessage);
                } catch (error) {
                    reject('Decryption error: Invalid password or corrupted message');
                }
            };

            img.onerror = () => {
                reject('Error loading image');
            };

            img.src = imageData;
        });
    }
}

// Export the class
window.Steganography = Steganography;