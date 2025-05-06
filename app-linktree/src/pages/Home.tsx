import React from 'react';
import { Link } from 'react-router-dom';
import PricingSection from '../components/home/PricingSection';
import HeroSection from '../components/home/HeroSection';
import FeaturesSection from '../components/home/FeaturesSection';
import Footer from '../components/home/Footer';
import { useAuth } from '../context/AuthContext';

const Home: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="bg-black text-white flex flex-col min-h-screen">
      <main className="flex-grow">
        <HeroSection user={user} />

        <FeaturesSection />

        <PricingSection />

        {/* Aquí puedes agregar más secciones de la página Home si es necesario */}
      </main>

      <Footer />
    </div>
  );
};

export default Home; 