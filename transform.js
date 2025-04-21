class Steganography {
	constructor() {
		this.loadCryptoJS();
	}

	// Load CryptoJS if not already available
	loadCryptoJS() {
		if (typeof CryptoJS === "undefined") {
			console.warn(
				"CryptoJS is required for encryption. Make sure to include the library."
			);
		}
	}

	// Convert text to binary
	textToBinary(text) {
		let binary = "";
		for (let i = 0; i < text.length; i++) {
			const charCode = text.charCodeAt(i);
			const charBinary = charCode.toString(2).padStart(8, "0");
			binary += charBinary;
		}
		return binary;
	}

	// Convert binary to text
	binaryToText(binary) {
		let text = "";
		for (let i = 0; i < binary.length; i += 8) {
			const byte = binary.substr(i, 8);
			const charCode = parseInt(byte, 2);
			text += String.fromCharCode(charCode);
		}
		return text;
	}

	// Encrypt message using AES
	encryptMessage(message, password) {
		try {
			return CryptoJS.AES.encrypt(message, password).toString();
		} catch (error) {
			throw new Error("Encryption failed: " + error.message);
		}
	}

	// Decrypt message using AES
	decryptMessage(encryptedMessage, password) {
		try {
			const bytes = CryptoJS.AES.decrypt(encryptedMessage, password);
			return bytes.toString(CryptoJS.enc.Utf8);
		} catch (error) {
			throw new Error("Decryption failed: Wrong password or corrupted data");
		}
	}

	// Haar DWT forward transform
	haarDWT(data, width, height) {
		const result = new Float32Array(data.length);

		// Perform horizontal transform
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x += 2) {
				const i = y * width + x;
				const avg = (data[i] + data[i + 1]) / 2;
				const diff = (data[i] - data[i + 1]) / 2;
				result[y * width + x / 2] = avg;
				result[y * width + width / 2 + x / 2] = diff;
			}
		}

		// Copy to data for vertical transform
		for (let i = 0; i < data.length; i++) {
			data[i] = result[i];
		}

		// Perform vertical transform
		for (let x = 0; x < width; x++) {
			for (let y = 0; y < height; y += 2) {
				const i1 = y * width + x;
				const i2 = (y + 1) * width + x;
				const avg = (data[i1] + data[i2]) / 2;
				const diff = (data[i1] - data[i2]) / 2;
				result[(y / 2) * width + x] = avg;
				result[(height / 2 + y / 2) * width + x] = diff;
			}
		}

		return result;
	}

	// Haar DWT inverse transform
	inverseHaarDWT(data, width, height) {
		const result = new Float32Array(data.length);

		// Perform vertical inverse transform
		for (let x = 0; x < width; x++) {
			for (let y = 0; y < height / 2; y++) {
				const avg = data[y * width + x];
				const diff = data[(height / 2 + y) * width + x];
				result[2 * y * width + x] = avg + diff;
				result[(2 * y + 1) * width + x] = avg - diff;
			}
		}

		// Copy to data for horizontal inverse transform
		for (let i = 0; i < data.length; i++) {
			data[i] = result[i];
		}

		// Perform horizontal inverse transform
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width / 2; x++) {
				const avg = data[y * width + x];
				const diff = data[y * width + width / 2 + x];
				result[y * width + 2 * x] = avg + diff;
				result[y * width + 2 * x + 1] = avg - diff;
			}
		}

		return result;
	}

	// Encode message in DWT coefficients with encryption
	async encode(imageDataUrl, message, password) {
		return new Promise((resolve, reject) => {
			try {
				// Create an image from data URL
				const img = new Image();
				img.onload = () => {
					// Create canvas and context
					const canvas = document.createElement("canvas");
					const ctx = canvas.getContext("2d");

					// Set canvas dimensions to match the image
					canvas.width = img.width;
					canvas.height = img.height;

					// Draw the image on the canvas
					ctx.drawImage(img, 0, 0);

					// Get the image data
					const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

					// Check if the image dimensions are compatible with DWT (must be power of 2 or divisible by 2)
					if (canvas.width % 2 !== 0 || canvas.height % 2 !== 0) {
						reject(
							new Error(
								"Image dimensions must be divisible by 2 for DWT transform"
							)
						);
						return;
					}

					// First encrypt the message
					const encryptedMessage = this.encryptMessage(message, password);

					try {
						// Encode the encrypted message
						const encodedImageData = this.encodeMessageInImage(
							imageData,
							encryptedMessage
						);

						// Put the encoded image data back to the canvas
						ctx.putImageData(encodedImageData, 0, 0);

						// Convert canvas to blob
						canvas.toBlob((blob) => {
							resolve(blob);
						}, "image/png");
					} catch (error) {
						reject(error);
					}
				};

				img.onerror = () => {
					reject(new Error("Failed to load image"));
				};

				img.src = imageDataUrl;
			} catch (error) {
				reject(error);
			}
		});
	}

	// Decode message from DWT coefficients with decryption
	async decode(imageDataUrl, password) {
		return new Promise((resolve, reject) => {
			try {
				// Create an image from data URL
				const img = new Image();
				img.onload = () => {
					// Create canvas and context
					const canvas = document.createElement("canvas");
					const ctx = canvas.getContext("2d");

					// Set canvas dimensions to match the image
					canvas.width = img.width;
					canvas.height = img.height;

					// Draw the image on the canvas
					ctx.drawImage(img, 0, 0);

					// Get the image data
					const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

					try {
						// Extract the encrypted message
						const encryptedMessage = this.decodeMessageFromImage(imageData);

						// Decrypt the message
						const decryptedMessage = this.decryptMessage(
							encryptedMessage,
							password
						);
						resolve(decryptedMessage);
					} catch (error) {
						reject(error);
					}
				};

				img.onerror = () => {
					reject(new Error("Failed to load image"));
				};

				img.src = imageDataUrl;
			} catch (error) {
				reject(error);
			}
		});
	}

	// Core function to encode message in image
	encodeMessageInImage(imageData, message) {
		// Extract dimensions and channels
		const width = imageData.width;
		const height = imageData.height;

		// Convert message to binary
		const binary = this.textToBinary(message);
		const messageLength = binary.length;

		// Check if the message can fit in the image
		const availableCoefficients = (width * height) / 4; // Using the HH subband of the DWT
		if (messageLength > availableCoefficients) {
			throw new Error("Message is too large for this image");
		}

		// Prepare image data arrays for each channel
		const redChannel = new Float32Array(width * height);
		const greenChannel = new Float32Array(width * height);
		const blueChannel = new Float32Array(width * height);

		// Extract channels
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const idx = (y * width + x) * 4;
				redChannel[y * width + x] = imageData.data[idx];
				greenChannel[y * width + x] = imageData.data[idx + 1];
				blueChannel[y * width + x] = imageData.data[idx + 2];
			}
		}

		// Apply DWT to each channel
		const redDWT = this.haarDWT(redChannel.slice(), width, height);
		const greenDWT = this.haarDWT(greenChannel.slice(), width, height);
		const blueDWT = this.haarDWT(blueChannel.slice(), width, height);

		// Store message length at the beginning of HH subband (bottom right quadrant)
		const lengthBinary = messageLength.toString(2).padStart(32, "0");
		for (let i = 0; i < 32; i++) {
			const x = width / 2 + (i % (width / 4));
			const y = height / 2 + Math.floor(i / (width / 4));
			const idx = y * width + x;

			// Embed in the least significant bit
			redDWT[idx] = Math.floor(redDWT[idx]);
			if (lengthBinary[i] === "1") {
				redDWT[idx] |= 1;
			} else {
				redDWT[idx] &= ~1;
			}
		}

		// Embed the message in the HH subband
		for (let i = 0; i < messageLength; i++) {
			// Calculate position in HH subband
			const x = width / 2 + ((i + 32) % (width / 4));
			const y = height / 2 + Math.floor((i + 32) / (width / 4));
			const idx = y * width + x;

			// Alternate embedding between channels for better distribution
			const channelIdx = i % 3;
			let dwtArray;

			if (channelIdx === 0) {
				dwtArray = redDWT;
			} else if (channelIdx === 1) {
				dwtArray = greenDWT;
			} else {
				dwtArray = blueDWT;
			}

			// Embed in the least significant bit
			dwtArray[idx] = Math.floor(dwtArray[idx]);
			if (binary[i] === "1") {
				dwtArray[idx] |= 1;
			} else {
				dwtArray[idx] &= ~1;
			}
		}

		// Apply inverse DWT
		const redInverse = this.inverseHaarDWT(redDWT, width, height);
		const greenInverse = this.inverseHaarDWT(greenDWT, width, height);
		const blueInverse = this.inverseHaarDWT(blueDWT, width, height);

		// Reconstruct the image
		const newData = new Uint8ClampedArray(width * height * 4);
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const idx = (y * width + x) * 4;
				newData[idx] = Math.max(
					0,
					Math.min(255, Math.round(redInverse[y * width + x]))
				);
				newData[idx + 1] = Math.max(
					0,
					Math.min(255, Math.round(greenInverse[y * width + x]))
				);
				newData[idx + 2] = Math.max(
					0,
					Math.min(255, Math.round(blueInverse[y * width + x]))
				);
				newData[idx + 3] = imageData.data[idx + 3]; // Keep original alpha
			}
		}

		return new ImageData(newData, width, height);
	}

	// Core function to decode message from image
	decodeMessageFromImage(imageData) {
		// Extract dimensions
		const width = imageData.width;
		const height = imageData.height;

		// Prepare image data arrays for each channel
		const redChannel = new Float32Array(width * height);
		const greenChannel = new Float32Array(width * height);
		const blueChannel = new Float32Array(width * height);

		// Extract channels
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const idx = (y * width + x) * 4;
				redChannel[y * width + x] = imageData.data[idx];
				greenChannel[y * width + x] = imageData.data[idx + 1];
				blueChannel[y * width + x] = imageData.data[idx + 2];
			}
		}

		// Apply DWT to each channel
		const redDWT = this.haarDWT(redChannel.slice(), width, height);
		const greenDWT = this.haarDWT(greenChannel.slice(), width, height);
		const blueDWT = this.haarDWT(blueChannel.slice(), width, height);

		// Extract message length from the beginning of HH subband
		let lengthBinary = "";
		for (let i = 0; i < 32; i++) {
			const x = width / 2 + (i % (width / 4));
			const y = height / 2 + Math.floor(i / (width / 4));
			const idx = y * width + x;

			// Extract the least significant bit
			lengthBinary += redDWT[idx] & 1 ? "1" : "0";
		}
		const messageLength = parseInt(lengthBinary, 2);

		// Extract the message
		let binary = "";
		for (let i = 0; i < messageLength; i++) {
			// Calculate position in HH subband
			const x = width / 2 + ((i + 32) % (width / 4));
			const y = height / 2 + Math.floor((i + 32) / (width / 4));
			const idx = y * width + x;

			// Alternate between channels based on the bit position
			const channelIdx = i % 3;
			let dwtArray;

			if (channelIdx === 0) {
				dwtArray = redDWT;
			} else if (channelIdx === 1) {
				dwtArray = greenDWT;
			} else {
				dwtArray = blueDWT;
			}

			// Extract the least significant bit
			binary += dwtArray[idx] & 1 ? "1" : "0";
		}

		return this.binaryToText(binary);
	}
}
