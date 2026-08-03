import Navbar from './components/Navbar';
import HeroSlider from './components/HeroSlider';
import StatsSection from './components/StatsSection';
import PillarsSection from './components/PillarsSection';
import NewsSection from './components/NewsSection';
import PartnersCarousel from './components/PartnersCarousel';
import CTASection from './components/CTASection';
import Footer from './components/Footer';

function App() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <HeroSlider />
      <StatsSection />
      <PillarsSection />
      <NewsSection />
      <PartnersCarousel />
      <CTASection />
      <Footer />
    </div>
  );
}

export default App;
