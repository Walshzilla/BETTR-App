import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import { useLocation } from 'react-router-dom';

// Example of a navigation component with map routing and location services
const NavigationMap = () => {
    const location = useLocation();

    const handleStartDrive = () => {
        console.log('Starting drive from:', location.pathname);
        // Implement your location service start drive logic here
    };

    return (
        <Router>
            <nav>
                <ul>
                    <li><a href="/home">Home</a></li>
                    <li><a href="/map">Map</a></li>
                    <li onClick={handleStartDrive}><a href="#">Start Drive</a></li>
                </ul>
            </nav>
            <Switch>
                <Route path="/home">
                    <h2>Home</h2>
                </Route>
                <Route path="/map">
                    <h2>Map Component Goes Here</h2>
                </Route>
            </Switch>
        </Router>
    );
};

export default NavigationMap;