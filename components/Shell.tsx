import Image from "next/image";
import type { ReactNode } from "react";
import {
  IconDiscord,
  IconGitHub,
  IconGlobe,
  IconPin,
  IconX,
} from "@/components/Icons";

/**
 * Shell chrome for the event page — DESIGN.md §4 items 1–10.
 *
 * These are deliberately plain. The judged surface is the RegistrationCard; this
 * is the frame it sits in. Every value comes from app/tokens.css via app/event.css,
 * so the hour-five restyle stays a one-file edit.
 */

export function TopNav() {
  return (
    <nav className="nav">
      <span className="navLogo">
        <Image src="/assets/monad-mark.jpg" alt="" width={24} height={24} className="hostAvatar" />
        No-Show
      </span>
      <span className="navRight">
        <span className="clock">Monad Testnet</span>
        <span className="pill">Create Event</span>
      </span>
    </nav>
  );
}

export function CoverImage() {
  return (
    <Image
      src="/assets/cover.jpg"
      alt="Monad Blitz Hyderabad V3"
      width={680}
      height={680}
      className="cover"
      priority
    />
  );
}

export function PresentedBy() {
  return (
    <div className="presentedBy">
      <Image src="/assets/monad-mark.jpg" alt="" width={28} height={28} className="hostAvatar" />
      <span style={{ flex: 1 }}>
        <span className="presentedLabel">Presented by</span>
        <br />
        <span className="orgName">Monad</span>
      </span>
      <span className="pill">Follow</span>
    </div>
  );
}

export function SocialRow() {
  return (
    <div className="socialRow" aria-label="Social links">
      <IconX />
      <IconGitHub />
      <IconDiscord />
      <IconGlobe />
    </div>
  );
}

export function SectionHeading({ children }: { children: ReactNode }) {
  return <h2 className="sectionHeading">{children}</h2>;
}

export function HostRow({ avatar, name }: { avatar: string; name: string }) {
  return (
    <div className="hostRow">
      <Image src={avatar} alt="" width={26} height={26} className="hostAvatar" />
      <span className="hostName" style={{ flex: 1 }}>
        {name}
      </span>
      <IconX />
    </div>
  );
}

export function EventTitle() {
  return <h1 className="title">Monad Blitz Hyderabad V3</h1>;
}

export function DateTile({ month, day }: { month: string; day: string }) {
  return (
    <div className="dateTile">
      <div className="tileMonth">{month}</div>
      <div className="tileDay">{day}</div>
    </div>
  );
}

export function DateBlock() {
  return (
    <div className="dateBlock">
      <div className="dateRow">
        <DateTile month="Aug" day="22" />
        <span>
          <span className="dateText">Saturday, August 22</span>
          <br />
          <span className="dateSub">10:00 — 20:00 IST</span>
        </span>
      </div>
      <LocationRow />
    </div>
  );
}

export function LocationRow() {
  return (
    <div className="dateRow">
      <span className="locIcon">
        <IconPin />
      </span>
      <span>
        <span className="dateText">Kapil Kavuri Hub ↗</span>
        <br />
        <span className="dateSub">Financial District, Hyderabad</span>
      </span>
    </div>
  );
}

export function AboutSection() {
  return (
    <section>
      <SectionHeading>About Event</SectionHeading>
      <div className="prose">
        <p>
          Registering holds $2. Turn up and it is released for zero — your money never
          moves, because no transaction is ever written.
        </p>
        <h3>🎟️ How check-in works</h3>
        <p>
          The venue screen shows a code derived from the current block number. It is
          only valid for three blocks, which on Monad is 1.2 seconds. Scan it and your
          wallet proves you were in the room. Nobody ticks you off a list — the chain
          checks.
        </p>
        <h3>💸 Why a hold and not a deposit</h3>
        <p>
          Kickback ran deposit-to-RSVP in 2018 and organisers found that demanding a
          stake was a barrier to entry. An x402 <code>upto</code> authorisation is a
          signature, not a payment: you sign a maximum, and showing up settles it for
          nothing.
        </p>
      </div>
    </section>
  );
}

export function LocationSection() {
  return (
    <section>
      <SectionHeading>Location</SectionHeading>
      <div className="prose">
        <p style={{ color: "var(--text)", fontWeight: 600, margin: 0 }}>Kapil Kavuri Hub</p>
        <p>Financial District, Nanakramguda, Hyderabad, Telangana 500032</p>
      </div>
      <div className="map">
        <span className="pill mapPill">Maps ↗</span>
      </div>
    </section>
  );
}

export function HostsSection() {
  return (
    <section>
      <SectionHeading>Hosted By</SectionHeading>
      <HostRow avatar="/assets/monad-mark.jpg" name="Monad" />
      <HostRow avatar="/assets/hyddao.jpg" name="Hyderabad DAO" />
      <HostRow avatar="/assets/host-1.jpg" name="Host" />
      <HostRow avatar="/assets/host-2.jpg" name="Host" />
      <HostRow avatar="/assets/host-3.jpg" name="Host" />
    </section>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <span>No-Show</span>
      <span>Contact the Host</span>
      <span>Report Event</span>
    </footer>
  );
}
