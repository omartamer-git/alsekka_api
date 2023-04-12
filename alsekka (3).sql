-- phpMyAdmin SQL Dump
-- version 5.2.0
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Mar 19, 2023 at 03:46 PM
-- Server version: 10.4.27-MariaDB
-- PHP Version: 8.2.0

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `alsekka`
--

-- --------------------------------------------------------

--
-- Table structure for table `cars`
--

CREATE TABLE `cars` (
  `id` int(11) NOT NULL,
  `driver` int(11) NOT NULL,
  `brand` varchar(12) NOT NULL,
  `year` smallint(4) NOT NULL,
  `model` varchar(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `passengers`
--

CREATE TABLE `passengers` (
  `id` int(11) NOT NULL,
  `passenger` int(11) NOT NULL,
  `ride` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `passengers`
--

INSERT INTO `passengers` (`id`, `passenger`, `ride`) VALUES
(2, 4, 1);

-- --------------------------------------------------------

--
-- Table structure for table `rides`
--

CREATE TABLE `rides` (
  `id` int(11) NOT NULL,
  `fromLatitude` decimal(8,6) NOT NULL,
  `fromLongitude` decimal(9,6) NOT NULL,
  `toLatitude` decimal(8,6) NOT NULL,
  `toLongitude` decimal(9,6) NOT NULL,
  `mainTextFrom` varchar(100) NOT NULL,
  `secondaryTextFrom` varchar(200) NOT NULL,
  `mainTextTo` varchar(100) NOT NULL,
  `secondaryTextTo` varchar(200) NOT NULL,
  `pricePerSeat` int(4) NOT NULL,
  `datetime` datetime NOT NULL DEFAULT current_timestamp(),
  `driver` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `rides`
--

INSERT INTO `rides` (`id`, `fromLatitude`, `fromLongitude`, `toLatitude`, `toLongitude`, `mainTextFrom`, `secondaryTextFrom`, `mainTextTo`, `secondaryTextTo`, `pricePerSeat`, `datetime`, `driver`) VALUES
(1, '29.988741', '31.438217', '30.020155', '31.496887', 'GUC University', 'Gamal Abdel Nasser, New Cairo 3', 'The American University in Cairo', 'AUC, New Cairo 1', 100, '2023-03-15 23:48:57', 0),
(3, '29.986828', '31.441346', '30.020151', '31.499081', 'Test 1', 'Test 3', 'Test 2', 'Test 4', 100, '2023-03-16 12:48:00', 4),
(4, '29.986828', '31.441346', '30.020151', '31.499081', 'Test 1', 'Test 3', 'Test 2', 'Test 4', 100, '2023-03-16 12:48:00', 4),
(5, '29.986828', '31.441346', '30.020151', '31.499081', 'Test 1', 'Test 3', 'Test 2', 'Test 4', 100, '2023-03-16 12:48:00', 4);

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `firstName` varchar(20) NOT NULL,
  `lastName` varchar(40) NOT NULL,
  `phone` varchar(16) NOT NULL,
  `email` varchar(320) NOT NULL,
  `password` char(64) NOT NULL,
  `balance` decimal(10,2) NOT NULL DEFAULT 0.00,
  `driver` tinyint(1) NOT NULL DEFAULT 0,
  `rating` decimal(2,1) NOT NULL DEFAULT 5.0,
  `profilePicture` text NOT NULL DEFAULT 'https://i.pinimg.com/564x/1f/0b/ed/1f0bedce4d40a21bd6106bd66915c2b9.jpg'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `firstName`, `lastName`, `phone`, `email`, `password`, `balance`, `driver`, `rating`, `profilePicture`) VALUES
(0, 'Omar', 'Tamer', '01000032800', 'imixman@hotmail.com', '$2b$10$AEEqFKbYNqcY4a7e8nEwC.Hv1Rkq1sLZyCL.w4HDdbz/ziEMj7us.', '0.00', 0, '4.5', 'https://i.pinimg.com/564x/1f/0b/ed/1f0bedce4d40a21bd6106bd66915c2b9.jpg'),
(1, 'Mohamed', 'Ahmed', '01005079623', 'Omartamer002@hotmail.com', '$2b$10$gHxsBIGZ/Z.KPa7LmiBbQOMv5rU.nXs1fh5okBFPZHZjtJhFC6OUm', '0.00', 0, '5.0', 'https://i.pinimg.com/564x/1f/0b/ed/1f0bedce4d40a21bd6106bd66915c2b9.jpg'),
(2, 'Shahd', 'Naguib', '01005079624', 'omartamer004@hotmail.com', '$2b$10$WUtyiPsZvs8OLd8AP2pHruii6VHULHEMoJURcrCkLV7S5X2g5FiPa', '0.00', 0, '5.0', 'https://i.pinimg.com/564x/1f/0b/ed/1f0bedce4d40a21bd6106bd66915c2b9.jpg'),
(3, 'Shady', 'Zoweil', '01000032801', 'oomartamer02@hotmail.com', '$2b$10$Hipgbzs0jBHa/kmOXKb9PO2o/EU9nEwumbn0N6K1iTA05dkUIIc1i', '0.00', 0, '5.0', 'https://i.pinimg.com/564x/1f/0b/ed/1f0bedce4d40a21bd6106bd66915c2b9.jpg'),
(4, 'Mahmoud', 'Boraei', '01000032802', 'kkk@hotmail.com', '$2b$10$Zom3uu08rVui2c8DH1Y1GuvkFowi.icembVoxv.y9P0YgO8tLZx1.', '0.00', 0, '5.0', 'https://i.pinimg.com/564x/1f/0b/ed/1f0bedce4d40a21bd6106bd66915c2b9.jpg'),
(14, 'Omar', 'Tamer', '01005079625', 'omartamer02@hotmail.com', '$2b$10$5J/hogfWEQLe9s9jxxPkwO3X9j476PDzo406.moIMK1r6JxS8TxOS', '0.00', 0, '5.0', 'https://i.pinimg.com/564x/1f/0b/ed/1f0bedce4d40a21bd6106bd66915c2b9.jpg'),
(15, 'Omar', 'Tamer', '01005079626', 'omartamer0002@hotmail.com', '$2b$10$ssZVhC53Pu5asDXkWxFyaO4ga9koz13CZh6ZX5FqqUntw2ONjnXCm', '0.00', 0, '5.0', 'https://i.pinimg.com/564x/1f/0b/ed/1f0bedce4d40a21bd6106bd66915c2b9.jpg');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `cars`
--
ALTER TABLE `cars`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `passengers`
--
ALTER TABLE `passengers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `passenger` (`passenger`,`ride`),
  ADD KEY `fk_driver_user` (`ride`);

--
-- Indexes for table `rides`
--
ALTER TABLE `rides`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_driver_id_from_user_id` (`driver`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `phone` (`phone`,`email`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `cars`
--
ALTER TABLE `cars`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `passengers`
--
ALTER TABLE `passengers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `rides`
--
ALTER TABLE `rides`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `passengers`
--
ALTER TABLE `passengers`
  ADD CONSTRAINT `fk_driver_user` FOREIGN KEY (`ride`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `fk_passenger_user` FOREIGN KEY (`passenger`) REFERENCES `users` (`id`);

--
-- Constraints for table `rides`
--
ALTER TABLE `rides`
  ADD CONSTRAINT `fk_driver_id_from_user_id` FOREIGN KEY (`driver`) REFERENCES `users` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
