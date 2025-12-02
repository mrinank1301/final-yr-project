import Navbar from "./components/landing/Navbar";
import HeroSection from "./components/landing/HeroSection";
import WhyUsSection from "./components/landing/WhyUsSection";
import FeaturesSection from "./components/landing/FeaturesSection";
import FAQSection from "./components/landing/FAQSection";
import ContactSection from "./components/landing/ContactSection";
import Footer from "./components/landing/Footer";

export default function Home() {
  return (
    <main className="min-h-screen bg-white selection:bg-blue-100 selection:text-blue-900">
      <Navbar />
      <HeroSection />
      <WhyUsSection />
      <FeaturesSection />
      <FAQSection />
      <ContactSection />
      <Footer />
    </main>
  );
}
