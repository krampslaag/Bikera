import logging
import asyncio
from telegram import Update
from telegram import ReplyKeyboardMarkup, KeyboardButton, ReplyKeyboardRemove
from telegram.ext import ConversationHandler
from telegram.ext import ApplicationBuilder
from telegram.ext import Application, CommandHandler, ContextTypes, MessageHandler, filters
import json
import time
import hashlib
import csv
import xml.etree.ElementTree as ET
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.backends import default_backend
import datetime
import random
from math import radians, sin, cos, sqrt, atan2
import asyncio
import os
from dotenv import load_dotenv
import signal

# Load environment variables
load_dotenv()
TELEGRAM_TOKEN = os.getenv('TELEGRAM_TOKEN')
WAITING_ADDRESS = 1
WAITING_LOCATION = 1

# Configure logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

def calculate_distance(coord1, coord2):
    """Calculate the distance between two coordinates using Haversine formula"""
    R = 6371  # Earth's radius in kilometers
    
    lat1, lon1 = map(radians, coord1)
    lat2, lon2 = map(radians, coord2)
    
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    distance = R * c
    
    return distance

def calculate_travel_distance(start_coords, end_coords):
    """Calculate the distance traveled between two coordinate pairs"""
    return calculate_distance(start_coords, end_coords)

class Block:
    def __init__(self, timestamp, data, previous_hash, target_distance=None, 
                 winner_id=None, travel_distance=None, miner_address=None):
        self.timestamp = timestamp
        self.data = data
        self.previous_hash = previous_hash
        self.target_distance = target_distance
        self.winner_id = winner_id
        self.travel_distance = travel_distance
        self.miner_address = miner_address
        self.hash = self.calculate_hash()
        self.reward = 1000.0

    def calculate_hash(self):
        # Include all fields in hash calculation for better verification
        hash_string = (
            f"{self.timestamp}{self.data}{self.previous_hash}"
            f"{self.target_distance}{self.winner_id}"
            f"{self.travel_distance}{self.miner_address}"
        )
        return hashlib.sha256(hash_string.encode()).hexdigest()

    def verify_hash(self, stored_hash):
        """Verify if stored hash matches calculated hash"""
        return stored_hash == self.hash

class Blockchain:
    def __init__(self):
        self.chain = [self.create_genesis_block()]
        
    def create_genesis_block(self):
        return Block(time.time(), "Genesis Block", "0")
        
    def add_block(self, data, target_distance, winner_id, travel_distance, miner_address):
        previous_block = self.chain[-1]
        new_block = Block(
            time.time(),
            data,
            previous_block.hash,
            target_distance,
            winner_id,
            travel_distance,
            miner_address
        )
        self.chain.append(new_block)
        return new_block

    def verify_chain(self):
        """Verify the integrity of the blockchain with more detailed logging"""
        try:
            for i in range(1, len(self.chain)):
                current = self.chain[i]
                previous = self.chain[i-1]
                
                logging.debug(f"Verifying block {i}")
                logging.debug(f"Previous hash stored: {current.previous_hash}")
                logging.debug(f"Previous block hash: {previous.hash}")
                
                if current.previous_hash != previous.hash:
                    logging.error(f"Hash mismatch at block {i}")
                    logging.error(f"Current block previous_hash: {current.previous_hash}")
                    logging.error(f"Previous block hash: {previous.hash}")
                    return False
            return True
        except Exception as e:
            logging.error(f"Error during chain verification: {e}")
            return False

def load_blockchain_from_csv(self, filename="data/Blocks.csv"):
    """Load blockchain data from CSV file with lenient verification"""
    if not os.path.exists(filename):
        logging.info("No existing blockchain CSV file found. Starting fresh.")
        return

    try:
        # Start fresh with just genesis block
        genesis = self.blockchain.chain[0]
        self.blockchain.chain = [genesis]
        
        with open(filename, 'r', newline='') as file:
            reader = csv.DictReader(file)
            prev_hash = genesis.hash
            
            for row in reader:
                try:
                    # Convert timestamp with fallback formats
                    try:
                        timestamp = datetime.datetime.strptime(
                            row['Timestamp'], 
                            '%Y-%m-%d %H:%M:%S.%f'
                        ).timestamp()
                    except ValueError:
                        timestamp = datetime.datetime.strptime(
                            row['Timestamp'], 
                            '%Y-%m-%d %H:%M:%S'
                        ).timestamp()

                    # Create new block
                    new_block = Block(
                        timestamp=timestamp,
                        data="Block Data",
                        previous_hash=prev_hash,
                        target_distance=float(row['Target Distance']) if row['Target Distance'] else None,
                        winner_id=int(float(row['Winner ID'])) if row['Winner ID'] else None,
                        travel_distance=float(row['Travel Distance']) if row['Travel Distance'] else None,
                        miner_address=row['Miner Address'] if row['Miner Address'] else None
                    )
                    
                    # Set the block hash from CSV
                    stored_hash = row['Block Hash']
                    if stored_hash:
                        new_block.hash = stored_hash
                    
                    self.blockchain.chain.append(new_block)
                    prev_hash = new_block.hash
                    
                except (ValueError, KeyError) as e:
                    logging.warning(f"Error processing row: {e}")
                    continue

            self.interval_count = len(self.blockchain.chain) - 1
            logging.info(f"Successfully loaded {self.interval_count} blocks from CSV file")

            # Print first few blocks for debugging
            for i in range(min(5, len(self.blockchain.chain))):
                block = self.blockchain.chain[i]
                logging.debug(f"Block {i}:")
                logging.debug(f"Hash: {block.hash}")
                logging.debug(f"Previous Hash: {block.previous_hash}")

            if not self.blockchain.verify_chain():
                raise ValueError("Loaded blockchain failed verification")
                
    except Exception as e:
        logging.error(f"Error loading blockchain from CSV: {e}")
        raise

def initialize_from_previous_state(self):
    """Initialize the system from previous state with more error tolerance"""
    try:
        self.load_blockchain_from_csv()
        
        # Even if blockchain verification fails, try to load user data
        rewards_file = "data/mining_rewards.csv"
        if os.path.exists(rewards_file):
            with open(rewards_file, 'r') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    for block in self.blockchain.chain:
                        if block.miner_address == row['Miner Address']:
                            if block.winner_id:
                                self.user_addresses[block.winner_id] = row['Miner Address']
                                break

        for block in self.blockchain.chain:
            if block.winner_id and block.winner_id not in self.user_keys:
                self.generate_user_keys(block.winner_id)
                
        logging.info("System state initialized from previous data")
        
    except Exception as e:
        logging.error(f"Error initializing from previous state: {e}")
        raise

class MiningInterval:
    def __init__(self):
        self.start_time = None
        self.is_active = False
        self.staged_coordinates = {}  # Dict of user_id: {latest_coords, timestamp}
        self.finalized_coordinates = {}  # Dict of user_id: {start_coords, end_coords}
        self.target_distance = None

    def start(self):
        self.start_time = time.time()
        self.is_active = True
        self.target_distance = random.uniform(0.001, 10.0)  # Random target distance in km
        return self.target_distance

    def stage_coordinates(self, user_id, coordinates):
        self.staged_coordinates[user_id] = {
            'coords': coordinates,
            'timestamp': time.time()
        }

    def finalize_interval(self):
        """Finalize coordinates for all users at block interval end"""
        self.is_active = False
        
        for user_id in self.staged_coordinates:
            coords_history = self.staged_coordinates[user_id]
            self.finalized_coordinates[user_id] = {
                'start_coords': coords_history['coords'],
                'end_coords': coords_history['coords']
            }
        
        self.staged_coordinates = {}  # Clear staged coordinates
        return self.finalized_coordinates

    def get_time_remaining(self):
        """Get remaining time in current block interval"""
        if not self.is_active:
            return 0
        elapsed = time.time() - self.start_time
        remaining = max(0, 600 - elapsed)  # 600 seconds = 10 minutes
        return int(remaining)

class LocationLogger:
    def __init__(self):
        self.blockchain = Blockchain()
        self.user_keys = {}
        self.user_addresses = {}
        self.current_interval = MiningInterval()
        self.previous_interval = None
        self.interval_count = 0
        self.coordinate_log = {}
        
        # Ensure data directory exists
        self.ensure_data_directory()
        
        # Initialize from previous state if available
        try:
            self.initialize_from_previous_state()
        except Exception as e:
            logging.error(f"Failed to initialize from previous state: {e}")
            logging.info("Starting with fresh blockchain")
            
    def load_blockchain_from_csv(self, filename="data/Blocks.csv"):
        """Load blockchain data from CSV file"""
        if not os.path.exists(filename):
            logging.info("No existing blockchain CSV file found. Starting fresh.")
            return

        try:
            with open(filename, 'r', newline='') as file:
                reader = csv.DictReader(file)
                
                # Clear existing chain except genesis block
                self.blockchain.chain = [self.blockchain.chain[0]]
                
                for row in reader:
                    try:
                        # Convert timestamp string back to timestamp
                        timestamp = datetime.datetime.strptime(row['Timestamp'], 
                                                            '%Y-%m-%d %H:%M:%S.%f').timestamp()
                        
                        # Create new block
                        new_block = Block(
                            timestamp=timestamp,
                            data="",  # We'll load detailed data from mining_rewards.csv
                            previous_hash=self.blockchain.chain[-1].hash,
                            target_distance=float(row['Target Distance']) if row['Target Distance'] else None,
                            winner_id=int(row['Winner ID']) if row['Winner ID'] else None,
                            travel_distance=float(row['Travel Distance']) if row['Travel Distance'] else None,
                            miner_address=row['Miner Address'] if row['Miner Address'] else None
                        )
                        
                        # Set the hash from CSV
                        new_block.hash = row['Block Hash']
                        
                        # Add block to chain
                        self.blockchain.chain.append(new_block)
                        
                    except (ValueError, KeyError) as e:
                        logging.warning(f"Skipping invalid block in CSV: {e}")
                        continue
                
                # Update interval count
                self.interval_count = len(self.blockchain.chain) - 1
                
                logging.info(f"Successfully loaded {self.interval_count} blocks from CSV file")
                
                # Verify the loaded chain
                if not self.blockchain.verify_chain():
                    raise ValueError("Loaded blockchain failed verification")
                    
        except Exception as e:
            logging.error(f"Error loading blockchain from CSV: {e}")
            raise
            
    def initialize_from_previous_state(self):
        """Initialize the system from previous state"""
        try:
            # Try loading from CSV first (preferred method)
            self.load_blockchain_from_csv()
            
            # Load user addresses from mining rewards
            rewards_file = "data/mining_rewards.csv"
            if os.path.exists(rewards_file):
                with open(rewards_file, 'r') as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        # Find user_id from blockchain data
                        for block in self.blockchain.chain:
                            if block.miner_address == row['Miner Address']:
                                if block.winner_id:
                                    self.user_addresses[block.winner_id] = row['Miner Address']
                                    break
            
            # Generate new keys for users found in blockchain
            for block in self.blockchain.chain:
                if block.winner_id and block.winner_id not in self.user_keys:
                    self.generate_user_keys(block.winner_id)
                    
            logging.info("System state initialized from previous data")
            
        except Exception as e:
            logging.error(f"Error initializing from previous state: {e}")
            raise
            
    def ensure_data_directory(self):
        """Ensure the data directory exists"""
        if not os.path.exists('data'):
            os.makedirs('data')
        if not os.path.exists('data/user_logs'):
            os.makedirs('data/user_logs')

    def generate_user_keys(self, user_id):
        """Generate RSA key pair for a user"""
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
            backend=default_backend()
        )
        public_key = private_key.public_key()
        
        self.user_keys[user_id] = {
            'private': private_key,
            'public': public_key
        }
        
        return public_key

    def encrypt_coordinates(self, public_key, coordinates):
        """Encrypt coordinates using RSA"""
        coords_bytes = json.dumps(coordinates).encode()
        encrypted = public_key.encrypt(
            coords_bytes,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None
            )
        )
        return encrypted

    def log_user_coordinates(self, user_id, coordinates, timestamp):
        """Log encrypted coordinates for a user"""
        if user_id not in self.coordinate_log:
            self.coordinate_log[user_id] = []
        
        encrypted_coords = self.encrypt_coordinates(
            self.user_keys[user_id]['public'],
            coordinates
        )
        
        log_entry = {
            'timestamp': timestamp,
            'encrypted_coordinates': encrypted_coords.hex(),
        }
        
        self.coordinate_log[user_id].append(log_entry)
        self.save_user_log(user_id)

    def save_user_log(self, user_id):
        """Save user's coordinate log to a file"""
        filename = f"data/user_logs/user_{user_id}_coordinates.json"
        with open(filename, 'w') as f:
            json.dump(self.coordinate_log[user_id], f, indent=2)
            
    def save_to_xml(self):
        """Save blockchain data to XML file"""
        try:
            filepath = self.export_blockchain_xml()
            logging.info(f"Blockchain saved to {filepath}")
            return filepath
        except Exception as e:
            logging.error(f"Error saving blockchain to XML: {e}")
            raise
        
    async def start_mining_intervals(self):
        try:
            while True:
                self.interval_count += 1
                target_distance = self.current_interval.start()
                logging.info(f"Starting block interval {self.interval_count}")

                try:
                    await asyncio.sleep(600)  # 10 minutes
                except asyncio.CancelledError:
                    logging.info("Mining blocks cancelled")
                    break

                current_coords = self.current_interval.finalize_interval()

                if self.previous_interval and self.interval_count > 2:
                    winner = self.determine_winner(self.previous_interval, current_coords, target_distance)
                    if winner:
                        self.process_winner(winner, target_distance)

                self.previous_interval = current_coords
                self.current_interval = MiningInterval()
        except Exception as e:
            logging.error(f"Error in mining block: {e}")

    def determine_winner(self, previous_coords, current_coords, target_distance):
        """Determine winner excluding users with travel distance > 10km"""
        winner = None
        closest_difference = float('inf')
        MAX_ALLOWED_DISTANCE = 10.0  # Maximum allowed travel distance in km
        
        for user_id in previous_coords:
            if user_id in current_coords:
                travel_distance = calculate_travel_distance(
                    previous_coords[user_id]['end_coords'],
                    current_coords[user_id]['end_coords']
                )
                
                # Skip users who traveled more than 10km
                if travel_distance > MAX_ALLOWED_DISTANCE:
                    logging.warning(f"User {user_id} traveled {travel_distance:.2f}km, exceeding {MAX_ALLOWED_DISTANCE}km limit")
                    continue
                
                difference = abs(travel_distance - target_distance)
                if difference < closest_difference:
                    closest_difference = difference
                    winner = {
                        'user_id': user_id,
                        'travel_distance': travel_distance,
                        'start_coords': previous_coords[user_id]['end_coords'],
                        'end_coords': current_coords[user_id]['end_coords']
                    }
        
        if winner:
            logging.info(f"Winner found: User {winner['user_id']} with travel distance {winner['travel_distance']:.2f}km")
        else:
            logging.info("No eligible winner found for this block")
            
        return winner

    def process_winner(self, winner, target_distance):
        """Process block winner with improved logging"""
        if winner['user_id'] not in self.user_addresses:
            logging.warning(f"Winner {winner['user_id']} has no registered Solana address")
            return

        try:
            logging.info(f"Processing winner for block {len(self.blockchain.chain)}")
            logging.info(f"Winner ID: {winner['user_id']}")
            logging.info(f"Travel Distance: {winner['travel_distance']:.2f}km")
            logging.info(f"Target Distance: {target_distance:.2f}km")

            encrypted_start = self.encrypt_coordinates(
                self.user_keys[winner['user_id']]['public'],
                winner['start_coords']
            )
            encrypted_end = self.encrypt_coordinates(
                self.user_keys[winner['user_id']]['public'],
                winner['end_coords']
            )

            block_data = json.dumps({
                'user_id': winner['user_id'],
                'encrypted_start': encrypted_start.hex(),
                'encrypted_end': encrypted_end.hex(),
                'timestamp': time.time()
            })

            new_block = self.blockchain.add_block(
                block_data,
                target_distance,
                winner['user_id'],
                winner['travel_distance'],
                self.user_addresses[winner['user_id']]
            )
            
            logging.info("Saving blockchain data to files...")
            self.save_to_csv()
            self.save_to_xml()
            self.save_mining_rewards()
            logging.info("All blockchain data saved successfully")
            
        except Exception as e:
            logging.error(f"Error processing winner: {e}")
            raise

    def save_to_csv(self, filename="data/Blocks.csv"):
        """Save blockchain data to CSV file"""
        try:
            # Ensure directory exists
            os.makedirs(os.path.dirname(filename), exist_ok=True)
            
            with open(filename, 'w', newline='') as file:
                writer = csv.writer(file)
                # Write headers
                writer.writerow(['Block Number', 'Timestamp', 'Target Distance', 
                               'Winner ID', 'Travel Distance', 'Miner Address', 'Block Hash'])
                
                # Write all blocks except genesis
                blocks_written = 0
                for i, block in enumerate(self.blockchain.chain[1:], 1):
                    writer.writerow([
                        i,
                        datetime.datetime.fromtimestamp(block.timestamp).strftime('%Y-%m-%d %H:%M:%S.%f'),
                        block.target_distance,
                        block.winner_id,
                        block.travel_distance,
                        block.miner_address,
                        block.hash
                    ])
                    blocks_written += 1
                
            logging.info(f"Successfully saved {blocks_written} blocks to {filename}")
            
            # Verify file was written
            if os.path.exists(filename):
                file_size = os.path.getsize(filename)
                logging.info(f"CSV file size: {file_size} bytes")
            
        except Exception as e:
            logging.error(f"Error saving blockchain to CSV: {e}")
            raise

    def save_mining_rewards(self, filename="data/mining_rewards.csv"):
        """Save mining rewards to CSV file"""
        try:
            # Ensure directory exists
            os.makedirs(os.path.dirname(filename), exist_ok=True)
            
            rewards = {}
            # Calculate rewards for each miner
            for block in self.blockchain.chain[1:]:
                if block.miner_address:
                    rewards[block.miner_address] = rewards.get(block.miner_address, 0) + block.reward
            
            with open(filename, 'w', newline='') as file:
                writer = csv.writer(file)
                writer.writerow(['Miner Address', 'Total Rewards'])
                for address, reward in rewards.items():
                    writer.writerow([address, reward])
            
            logging.info(f"Successfully saved mining rewards for {len(rewards)} miners to {filename}")
            
            # Verify file was written
            if os.path.exists(filename):
                file_size = os.path.getsize(filename)
                logging.info(f"Rewards file size: {file_size} bytes")
                
        except Exception as e:
            logging.error(f"Error saving mining rewards: {e}")
            raise

    def export_blockchain_xml(self):
        """Export blockchain data to XML file"""
        root = ET.Element("blockchain")
        
        metadata = ET.SubElement(root, "metadata")
        ET.SubElement(metadata, "total_blocks").text = str(len(self.blockchain.chain))
        ET.SubElement(metadata, "last_update").text = datetime.datetime.now().isoformat()
        
        blocks = ET.SubElement(root, "blocks")
        for block in self.blockchain.chain:
            block_elem = ET.SubElement(blocks, "block")
            ET.SubElement(block_elem, "timestamp").text = datetime.datetime.fromtimestamp(block.timestamp).isoformat()
            ET.SubElement(block_elem, "hash").text = block.hash
            ET.SubElement(block_elem, "previous_hash").text = block.previous_hash
            if block.target_distance:
                ET.SubElement(block_elem, "target_distance").text = str(block.target_distance)
            if block.travel_distance:
                ET.SubElement(block_elem, "travel_distance").text = str(block.travel_distance)
            if block.winner_id:
                ET.SubElement(block_elem, "winner_id").text = str(block.winner_id)
            if block.miner_address:
                ET.SubElement(block_elem, "miner_address").text = str(block.miner_address)
            
            if block.data and block.data != "Genesis Block":
                try:
                    data_dict = json.loads(block.data)
                    data_elem = ET.SubElement(block_elem, "data")
                    for key, value in data_dict.items():
                        ET.SubElement(data_elem, key).text = str(value)
                except json.JSONDecodeError:
                    ET.SubElement(block_elem, "data").text = block.data

        filepath = "data/blockchain_export.xml"
        tree = ET.ElementTree(root)
        tree.write(filepath, encoding='utf-8', xml_declaration=True)
        return filepath

    def get_user_stats(self, user_id):
        """Get statistics for a specific user"""
        wins = sum(1 for block in self.blockchain.chain if block.winner_id == user_id)
        total_rewards = sum(block.reward for block in self.blockchain.chain if block.winner_id == user_id)
        participated_intervals = len([log for log in self.coordinate_log.get(user_id, [])])
        
        return {
            'total_wins': wins,
            'total_rewards': total_rewards,
            'participated_intervals': participated_intervals
        }

# Command Handlers
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    
    if user_id not in logger.user_keys:
        public_key = logger.generate_user_keys(user_id)
        await update.message.reply_text(
            "Welcome to the GPS Bikera iMERA distribution Bot!\n\n"
            "Your encryption keys have been generated.\n"
            "Please set your Solana address using /setaddress.\n\n"
            "Use /help to see all available commands."
        )
    else:
        await update.message.reply_text(
            "Welcome back!\n"
            "Your encryption keys are already set up.\n"
            "Use /help to see all available commands."
        )

async def interval_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Get previous block info
    if len(logger.blockchain.chain) > 1:
        prev_block = logger.blockchain.chain[-1]
        prev_winner_id = prev_block.winner_id
        prev_distance = prev_block.travel_distance
        prev_target = prev_block.target_distance
        winner_info = ""
        if prev_winner_id:
            winner_address = prev_block.miner_address
            winner_info = (
                f"\n🏆 Previous Winner: {prev_winner_id}\n"
                f"📍 Distance: {prev_distance:.2f}km\n"
                f"🎯 Target: {prev_target:.2f}km\n"
                f"💰 Address: {winner_address[:6]}...{winner_address[-4:]}\n"
            )
    else:
        winner_info = "\nNo previous blocks yet.\n"

    if logger.current_interval.is_active:
        time_remaining = int(600 - (time.time() - logger.current_interval.start_time))
        participants = len(logger.current_interval.staged_coordinates)
        target = logger.current_interval.target_distance
        await update.message.reply_text(
            f"Block {logger.interval_count} in progress!\n"
            f"⏱️ Time remaining: {time_remaining} seconds\n"
            f"👥 Current participants: {participants}\n"
            f"🎯 Target distance: {target:.2f}km\n"
            f"First two blocks collect data only.\n"
            f"{winner_info}"
        )
    else:
        await update.message.reply_text(
            f"No active block interval. Next block starting soon!\n"
            f"{winner_info}"
        )

async def start_address_conversation(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Please enter your Solana address:"
    )
    return WAITING_ADDRESS

async def handle_address_input(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    address = update.message.text.strip()

    # Basic length check only (between 32-44 characters)
    if len(address) < 32 or len(address) > 44:
        await update.message.reply_text("Address should be between 32 and 44 characters. Please try again with /setaddress")
        return ConversationHandler.END

    logger.user_addresses[user_id] = address
    await update.message.reply_text(
        f"✅ Solana address set successfully!\n"
        f"Address: {address[:6]}...{address[-4:]}\n\n"
        f"You can now participate in Proof-of-Transit mining.\n"
        f"Use /status to check current block interval status."
    )
    return ConversationHandler.END

async def cancel_address(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("Address setting cancelled. You can try again with /setaddress")
    return ConversationHandler.END

async def start_location_conversation(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    
    # Check if user has keys
    if user_id not in logger.user_keys:
        await update.message.reply_text("Please use /start first to generate your keys.")
        return ConversationHandler.END
        
    # Check if user has set address
    if user_id not in logger.user_addresses:
        await update.message.reply_text("Please set your Solana address using /setaddress first.")
        return ConversationHandler.END
        
    # Check if interval is active
    if not logger.current_interval.is_active:
        await update.message.reply_text("No active block. Please wait for the next block interval to start.")
        return ConversationHandler.END

    keyboard = [[KeyboardButton(text="Share Location", request_location=True)]]
    reply_markup = ReplyKeyboardMarkup(keyboard, one_time_keyboard=True, resize_keyboard=True)

    await update.message.reply_text(
        "Please share your location using the button below 📍\n\n"
        "You can do this by:\n"
        "1. Click the attachment (📎) or (+) icon\n"
        "2. Select 'Location'\n"
        "3. Share your current location\n\n"
        "Type /cancel to cancel location sharing.",
        reply_markup=reply_markup
    )
    return WAITING_LOCATION

async def handle_location_input(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    location = update.message.location
    if not location:
        await update.message.reply_text(
            "Please share a valid location or use /cancel to cancel.",
            reply_markup=ReplyKeyboardRemove()
        )
        return WAITING_LOCATION
        
    coordinates = (location.latitude, location.longitude)
    
    # Check if user has previous coordinates in this interval
    if user_id in logger.current_interval.staged_coordinates:
        prev_coords = logger.current_interval.staged_coordinates[user_id]['coords']
        distance = calculate_travel_distance(prev_coords, coordinates)
        
        if distance > 10.0:  # 10 km limit
            await update.message.reply_text(
                f"⚠️ Warning: This location is {distance:.2f}km from your previous position.\n"
                f"Distances over 10km are not eligible for winning blocks.\n"
                f"Please submit a location closer to your previous position.",
                reply_markup=ReplyKeyboardRemove()
            )
            return WAITING_LOCATION
    
    # Stage the coordinates
    logger.current_interval.stage_coordinates(user_id, coordinates)
    time_remaining = int(600 - (time.time() - logger.current_interval.start_time))
    participants = len(logger.current_interval.staged_coordinates)
    
    await update.message.reply_text(
        f"✅ Location successfully staged for this block!\n"
        f"⏱️ Time remaining: {time_remaining} seconds\n"
        f"📍 Your coordinates will be finalized when block is mined.\n"
        f"👥 Current participants: {participants}\n"
        f"🎯 Target distance: {logger.current_interval.target_distance:.2f}km\n\n"
        f"You can update your location again by using /location before the block is mined.",
        reply_markup=ReplyKeyboardRemove()
    )
    return ConversationHandler.END
    
async def cancel_location(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Location sharing cancelled. You can try again with /location",
        reply_markup=ReplyKeyboardRemove()
    )
    return ConversationHandler.END

async def download_blockchain(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handler for downloading blockchain data"""
    try:
        filepath = logger.export_blockchain_xml()
        with open(filepath, 'rb') as f:
            await update.message.reply_document(
                document=f,
                filename="blockchain_export.xml",
                caption="Here's the current blockchain data in XML format."
            )
    except Exception as e:
        logging.error(f"Error exporting blockchain: {e}")
        await update.message.reply_text("Sorry, there was an error generating the blockchain export.")

async def download_coordinates(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handler for downloading user's coordinates"""
    user_id = update.effective_user.id

    if user_id not in logger.user_keys:
        await update.message.reply_text("Please use /start first to generate your keys.")
        return

    filepath = f"data/user_logs/user_{user_id}_coordinates.json"
    if not os.path.exists(filepath):
        await update.message.reply_text("No coordinate data found for your account yet.")
        return

    try:
        with open(filepath, 'rb') as f:
            await update.message.reply_document(
                document=f,
                filename=f"coordinates_{user_id}.json",
                caption="Here are your logged coordinates (encrypted)."
            )
    except Exception as e:
        logging.error(f"Error sending coordinates file: {e}")
        await update.message.reply_text("Sorry, there was an error retrieving your coordinates.")

async def get_stats(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handler for getting user statistics"""
    user_id = update.effective_user.id

    if user_id not in logger.user_keys:
        await update.message.reply_text("Please use /start first to generate your keys.")
        return

    stats = logger.get_user_stats(user_id)
    await update.message.reply_text(
        f"📊 Your Statistics:\n\n"
        f"🏆 Total Wins: {stats['total_wins']}\n"
        f"💰 Total Rewards: {stats['total_rewards']} iMERA\n"
        f"🎯 Participated blocks: {stats['participated_intervals']}\n\n"
        f"Use /download_coordinates to get your logged coordinates\n"
        f"Use /download_blockchain to get the complete blockchain data"
    )

async def handle_location(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    location = update.message.location

    if user_id not in logger.user_keys:
        await update.message.reply_text("Please use /start first to generate your keys.")
        return

    if user_id not in logger.user_addresses:
        await update.message.reply_text("Please set your Solana address using /setaddress first.")
        return

    if not logger.current_interval.is_active:
        await update.message.reply_text("No active block. Please wait for the next block interval to start.")
        return

    coordinates = (location.latitude, location.longitude)
    logger.current_interval.stage_coordinates(user_id, coordinates)

    time_remaining = int(600 - (time.time() - logger.current_interval.start_time))

    await update.message.reply_text(
        f"Location staged for this interval!\n"
        f"Time remaining: {time_remaining} seconds\n"
        f"Your coordinates will be finalized at block interval end.\n"
        f"Target distance: {logger.current_interval.target_distance:.2f}km\n"
        f"You can update your location until the block is mined."
    )

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    help_text = """
🌍 Bikera iMERA distribution Bot Commands:

/start - Initialize your encryption keys
/setaddress - Set your Solana address
/location - Start location sharing process
/status - Check current block status
/rewards - View your mining statistics and rewards
/help - Show this help message
/download_blockchain - Download complete blockchain data
/download_coordinates - Download your logged coordinates
/cancel - cancel inputs

📱 Share your location to participate!
You can update your location multiple times during an active block

⛏️ Mining Process:
• First two blocks collect initial data
• Winners determined from third block onward
• Each interval lasts 10 minutes
• Target distance generated randomly (0.01-10km)
• Closest to target distance wins the interval
• Winners receive rewards to Solana address

🔒 Security:
• All location data is encrypted
• RSA encryption for coordinates
• Blockchain-based logging
"""
    await update.message.reply_text(help_text)
    
address_conv_handler = ConversationHandler(
    entry_points=[CommandHandler('setaddress', start_address_conversation)],
    states={
        WAITING_ADDRESS: [MessageHandler(filters.TEXT & ~filters.COMMAND, handle_address_input)]
    },
    fallbacks=[CommandHandler('cancel', cancel_address)]
)

location_conv_handler = ConversationHandler(
    entry_points=[CommandHandler('location', start_location_conversation)],
    states={
        WAITING_LOCATION: [
            MessageHandler(filters.LOCATION, handle_location_input),
            MessageHandler(filters.TEXT & ~filters.COMMAND, lambda u, c: u.message.reply_text("Please use the location share button or /cancel"))
        ]
    },
    fallbacks=[CommandHandler('cancel', cancel_location)]
)

async def run_polling(application):
    """Run the bot polling in a separate coroutine"""
    await application.initialize()
    try:
        await application.start()
        await application.run_polling(allowed_updates=Update.ALL_TYPES)
    finally:
        await application.stop()
        await application.shutdown()

class TelegramBot:
    def __init__(self, token):
        self.token = token
        self.app = ApplicationBuilder().token(token).build()
        self.mining_task = None
        self.stop_flag = asyncio.Event()

    async def mining_loop(self):
        while not self.stop_flag.is_set():
            try:
                logger.interval_count += 1
                target_distance = logger.current_interval.start()
                logging.info(f"Starting block interval {logger.interval_count}")

                # Wait for either 10 minutes or stop signal
                try:
                    await asyncio.wait_for(self.stop_flag.wait(), timeout=600)
                except asyncio.TimeoutError:
                    pass

                if not self.stop_flag.is_set():
                    current_coords = logger.current_interval.finalize_interval()
                    if logger.previous_interval and logger.interval_count > 2:
                        winner = logger.determine_winner(logger.previous_interval, current_coords, target_distance)
                        if winner:
                            logger.process_winner(winner, target_distance)
                    logger.previous_interval = current_coords
                    logger.current_interval = MiningInterval()
            except Exception as e:
                logging.error(f"Mining error: {e}")
                if not self.stop_flag.is_set():
                    await asyncio.sleep(5)

    async def start(self):
        # Add handlers
        self.app.add_handler(CommandHandler("start", start))
        self.app.add_handler(CommandHandler("help", help_command))
        self.app.add_handler(address_conv_handler) 
        self.app.add_handler(location_conv_handler)
        self.app.add_handler(CommandHandler("status", interval_status))
        self.app.add_handler(CommandHandler("rewards", get_stats))
        self.app.add_handler(CommandHandler("download_blockchain", download_blockchain))
        self.app.add_handler(CommandHandler("download_coordinates", download_coordinates))
        self.app.add_handler(MessageHandler(filters.LOCATION, handle_location))

        # Start mining in background
        self.mining_task = asyncio.create_task(self.mining_loop())

        # Start bot
        await self.app.initialize()
        await self.app.start()
        await self.app.updater.start_polling()

        logging.info("Bot started successfully")

        # Wait for stop signal
        await self.stop_flag.wait()

    async def stop(self):
        # Set stop flag
        self.stop_flag.set()

        # Cancel mining task
        if self.mining_task:
            self.mining_task.cancel()
            try:
                await self.mining_task
            except asyncio.CancelledError:
                pass

        # Stop bot
        await self.app.updater.stop()
        await self.app.stop()
        await self.app.shutdown()
        logging.info("Bot stopped successfully")

async def main():
    # Set up logging
    logging.basicConfig(
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        level=logging.INFO
    )

    # Initialize global logger
    global logger
    logger = LocationLogger()

    # Create bot instance
    bot = TelegramBot(TELEGRAM_TOKEN)

    # Handle shutdown gracefully
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, lambda: asyncio.create_task(bot.stop()))

    try:
        await bot.start()
    finally:
        await bot.stop()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
    except Exception as e:
        logging.error(f"Fatal error: {e}")
