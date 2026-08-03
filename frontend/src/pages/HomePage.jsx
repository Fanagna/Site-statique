import HeroSlider from '../components/HeroSlider';
import StatsSection from '../components/StatsSection';
import PillarsSection from '../components/PillarsSection';
import NewsSection from '../components/NewsSection';
import PartnersCarousel from '../components/PartnersCarousel';
import CTASection from '../components/CTASection';

export default function HomePage() {
  return (
    <>
      <HeroSlider />
      <StatsSection />
      <PillarsSection />
      <NewsSection />
      <PartnersCarousel />
      <CTASection />
    </>
  );
}
