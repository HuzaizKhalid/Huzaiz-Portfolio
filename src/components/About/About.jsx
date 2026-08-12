import React from "react";
import ReactTypingEffect from "react-typing-effect";
import Tilt from "react-parallax-tilt";
import staticProfileImage from "../../assets/work_logo/profile_pic.png";
import { trackResumeDownload } from "../../lib/analytics";

// Static fallback values (used when Supabase has no about data yet)
const DEFAULTS = {
  name: "Huzaiz Khalid Qureshi",
  tagline: "Software Engineer",
  roles: ["Software Engineer", "Full Stack Developer", "Freelancer", "CS Graduate"],
  about:
    "I am a full-stack developer with over 2 years of experience in building scalable web applications. Skilled in both front-end and back-end development, I specialize in the MERN stack and other modern technologies to create seamless user experiences and efficient solutions.",
  resumeUrl:
    "https://drive.google.com/uc?export=download&id=1NDPCJf8GgvfL6ii0paZnU7j1MpijE4qA",
  profileImage: "",
  github: "",
  linkedin: "",
};

/**
 * Merge Supabase data over DEFAULTS, but skip any empty / null values
 * so that a field left blank in the admin never hides hardcoded defaults.
 */
function mergeWithDefaults(supabaseData, defaults) {
  if (!supabaseData) return defaults;
  const result = { ...defaults };
  Object.entries(supabaseData).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== "") result[k] = v;
  });
  return result;
}

const About = ({ about }) => {
  const data = mergeWithDefaults(about, DEFAULTS);

  // Parse roles — stored as comma-separated string or already an array
  const roles = Array.isArray(data.roles)
    ? data.roles.filter(Boolean)
    : typeof data.roles === "string" && data.roles.trim()
    ? data.roles.split(",").map((r) => r.trim()).filter(Boolean)
    : DEFAULTS.roles;

  const profileSrc = data.profileImage || staticProfileImage;

  return (
    <section
      id="about"
      className="py-4 px-[7vw] md:px-[7vw] lg:px-[20vw] font-sans mt-16 md:mt-24 lg:mt-32"
    >
      <div className="flex flex-col-reverse md:flex-row justify-between items-center">
        {/* Left Side */}
        <div className="md:w-1/2 text-center md:text-left mt-8 md:mt-0">
          {/* Greeting */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-2 leading-tight">
            Hi, I am
          </h1>

          {/* Name */}
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-4 leading-tight">
            {data.name}
          </h2>

          {/* Typing animation */}
          <h3 className="text-xl sm:text-2xl md:text-3xl font-semibold mb-4 text-[#8245ec] leading-tight">
            <span className="text-white">I am a </span>
            <ReactTypingEffect
              text={roles}
              speed={100}
              eraseSpeed={50}
              typingDelay={500}
              eraseDelay={2000}
              cursorRenderer={(cursor) => (
                <span className="text-[#8245ec]">{cursor}</span>
              )}
            />
          </h3>

          {/* About paragraph */}
          <p className="text-base sm:text-lg md:text-lg text-gray-400 mb-10 mt-8 leading-relaxed">
            {data.about}
          </p>

          {/* Download CV button — always shown; resumeUrl has a fallback default */}
          <a
            href={data.resumeUrl}
            target="_blank"
            rel="noopener noreferrer"
            // sendBeacon survives the navigation this click triggers, so the
            // download is counted without delaying it.
            onClick={trackResumeDownload}
            className="inline-block text-white py-3 px-8 rounded-full mt-5 text-lg font-bold transition duration-300 transform hover:scale-105"
            style={{ background: "linear-gradient(90deg, #8245ec, #a855f7)" }}
          >
            DOWNLOAD CV
          </a>
        </div>

        {/* Right Side — Profile Photo */}
        <div className="md:w-1/2 flex justify-center md:justify-end">
          <Tilt
            className="w-48 h-48 sm:w-64 sm:h-64 md:w-[30rem] md:h-[30rem] border-4 border-purple-700 rounded-full"
            tiltMaxAngleX={20}
            tiltMaxAngleY={20}
            perspective={1000}
            scale={1.05}
            transitionSpeed={1000}
            gyroscope={true}
          >
            <img
              src={profileSrc}
              alt={data.name}
              className="w-full h-full rounded-full object-cover object-top drop-shadow-[0_10px_20px_rgba(130,69,236,0.5)]"
            />
          </Tilt>
        </div>
      </div>
    </section>
  );
};

export default About;
