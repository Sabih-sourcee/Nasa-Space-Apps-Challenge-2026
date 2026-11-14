# Build a Junior Astronaut Mission Trainer

Official page: https://www.spaceappschallenge.org/2026/challenges/build-a-junior-astronaut-mission-trainer/

The public HTML page is client-rendered and sometimes returns HTTP 500 to a simple request. The text below was pulled from the official Space Apps GraphQL API (`page` id `aWQ6NTUxMjQ=`, title "Build a Junior Astronaut Mission Trainer") on 14 Nov 2026, around 5:00 AM PKT. That is the official statement. If the website loads for you, treat the live page as the final word.

Level: Beginner/Youth and Intermediate.

Skills listed on the official page: Games, Planets & Moons, Software, Space Exploration, Sun.

## Summary (official excerpt)

Space-themed STEM content often oversimplifies the engineering trade-offs that define a real mission, or presents them at a level too complex to hold a young learner's attention. Few tools make those trade-offs both tangible and fun.

Your challenge is to design and build an interactive game or app that lets students run a lunar or Martian outpost, balancing competing demands like life support, radiation shielding, power, and food production, so they experience firsthand the decisions that determine whether a mission fails or succeeds.

## What the full statement asks for

Background. NASA is planning a sustained presence on the Moon and later Mars. Crews have to split limited power between life support, communications, and science, and they have to weigh radiation risk against mission goals. Mission planners already use real data, including solar activity and radiation risk from DONKI, astronaut radiation and biology research from OSDR, and environmental data from Artemis and Mars surface missions. Kids' space content is often too abstract or too technical, so students see outcomes, not the trade-offs.

Objectives. Build an interactive game or app that lets kids ages 7-12 manage a lunar or Martian outpost and make real decisions about life support, radiation shielding, power budgeting, food production, and communication delay. Ground the simulation in real NASA open data where possible (DONKI, OSDR, Artemis or Mars surface data). Do not invent numbers if real data can be used. Format is open: resource-management game, narrative decision simulator, mission-control dashboard, or something else, in the browser, on mobile, or on desktop. A working prototype that teaches one real constraint is the goal. Creative takes on "outpost" or "mission" are allowed if the educational goal stays central.

The official target age is 7-12. Keep the language simple enough for that group. Grade 6 sits at the top of that range; older grades can still play it, but do not pitch it only as a high-school tool.

Potential considerations (optional, from the official list):

- Audience and access: plain language; explain terms like radiation dose, microgravity, or sol in context; a browser game with no download and no account is easier for judges and for students later.
- Real data: use NASA public APIs and open datasets; credit the source inside the tool; if a live API call is not practical, embed a curated real dataset and do not present it as live.
- Design pitfalls: every choice should have a cost; a simple accurate mechanic beats a pretty empty one; two or three core resources (life support, power, shielding) are better than five or six.
- What stands out: link a shielding choice to real space weather; make events vary so kids can replay; tell judges which NASA datasets you used and why.

## Official datasets and resources

Copied from the Resources tab of the official challenge page, with the original links.

NASA data and resources:

- [NASA Open APIs](https://api.nasa.gov/): public API portal, including APOD, Mars Rover Photos, and DONKI. Request a free key (higher limits than `DEMO_KEY`) at that site.
- [Space Weather Database Of Notifications, Knowledge, Information (DONKI)](https://ccmc.gsfc.nasa.gov/tools/DONKI/): solar flares, coronal mass ejections, and other space weather that drives radiation risk.
- [NASA Open Science Data Repository (OSDR)](https://osdr.nasa.gov/bio/repo/): space biology and astronaut health research (bone density, muscle, immune response, sleep, and more). Search API: https://osdr.nasa.gov/osdr/data/search?term=KEYWORD
- [RadLab (OSDR Radiation Dosimetry Database)](https://visualization.osdr.nasa.gov/radlab/gui/data-api/): radiation dose measurements from instruments on the International Space Station.
- [Mars Trek](https://trek.nasa.gov/mars/): Mars surface imagery, elevation, and terrain from NASA Mars missions, including Curiosity and Perseverance.

Space agency partner resources (Canadian Space Agency):

- [Space resources for STEM and youth organizations](https://www.asc-csa.gc.ca/eng/youth-educators/resources-stem-and-youth-organizations.asp)
- [Food production on the moon and in remote areas](https://www.asc-csa.gc.ca/eng/youth-educators/toolkits/food-production/)

The official resources tab also notes: NASA does not endorse non-U.S. government sites, and you must follow those sites' data-use rules.

This team's extra prep data (Moon south pole illumination maps and the Mars Dust Activity Database) is not on that official resource list. It is still open NASA or academic data, and it fits a Moon-base power map and a later Mars dust event. List it in the project's References field if you use it. See [data/SOURCES.md](../data/SOURCES.md).

## Judging criteria

Source: [2026 Judging & Awards Guide](https://www.spaceappschallenge.org/resources/judging-awards-guide/), which is dated 13 Nov 2026 on the official site. The wording below is from that guide, not invented. The live guide is the final word if it changes.

At every level of judging, from Local and Universal Events to Executive Judging, the project is scored from 1 to 5 on each of these criteria:

### Impact

This project makes an impact by addressing either a minor or major problem, which influences the quality and quantity of its overall effect. The extent to which it inspires or helps others varies, ranging from a broad audience to a select few.

Score of 5 (Outstanding Impact): This project demonstrates exceptional impact, addressing a significant problem with proposed solutions. Its reach is extensive, inspiring, benefits a large audience, or could change the world. The quality and effectiveness of the project far exceeds expectations, setting a high standard for others.

### Creativity

This project demonstrates originality and innovation. It introduces a novel concept that has not been attempted before or presents an improvement upon existing ideas in a meaningful way. This project is distinguished by its level of creativity, showcasing a fresh perspective or inventive execution.

Score of 5 (Highly Creative and Innovative): This project showcases remarkable creativity, introducing a groundbreaking approach that has never been attempted before. It challenges conventional methods, presenting an original and inventive proposed solution that stands out in its field. The uniqueness of the idea makes it a true innovation.

### Validity

This project presents a proposed solution that is grounded in scientific principles and demonstrates technical, functional, or logical feasibility. It is designed to effectively achieve its intended purpose and has the potential to function in real-world applications. The completeness of the proposed solution varies — it may be fully developed or still require significant refinement. Additionally, the usability and user-friendliness of the project influence its practicality and accessibility.

Score of 5 (Highly Valid and Feasible): This proposed solution is scientifically sound and technically feasible, demonstrating strong alignment with established principles. It is fully developed and ready for real-world implementation, effectively achieving its intended purpose. The project is highly usable and user-friendly, making it accessible and practical for widespread application.

### Relevance

This project fully and directly addresses the challenge for which it was submitted, demonstrating a strong alignment with the intended objectives. It meaningfully integrates NASA data, utilizing it as a core component of the proposed solution rather than a superficial addition. The depth of engagement with the data enhances the project's credibility and effectiveness.

Score of 5 (Highly Relevant and Strong NASA Data Integration): This project thoroughly engages with the challenge, delivering a proposed solution that is deeply connected to the intended goals. NASA data is integral to the project's success, providing meaningful insights that drive the innovation forward. The use of data is well-executed, enhancing both the credibility and impact of the solution.

### Presentation

The team effectively communicated their project, clearly conveying the challenge, their proposed solution, and its significance. The storytelling was engaging and well-structured, ensuring the audience understood the project's purpose and impact. The clarity, organization, and delivery of their presentation played a key role in making their ideas compelling and clear. Judges evaluate the demo and full project to compute this score.

Score of 5 (Exceptional Communication and Storytelling): The team delivered a well-structured and compelling presentation, clearly articulating the challenge, proposed solution, and importance of the project. Their storytelling was engaging, allowing the audience to fully grasp the significance and potential impact of the work. The delivery was polished, structured, and highly effective in communicating their ideas.

The guide also says to give presentation equal weight, and to recruit storytelling and design skills, not only coding. Tips for the demo are in the [Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/).

## Submission rules that matter for the plan

From the same judging guide (eligibility section):

- Respond to one official challenge.
- All teammates must be registered for the same Local Event (Karachi) and listed on the team page. Teams may have 1 to 6 members for a Local Event.
- Complete all required submission fields.
- Provide a short demo: a slide presentation (7-slide limit, including title and intro slides) or a video presentation (30-second limit).
- Use English on the project submission page and in linked materials. A demo video may be in another language if it has English subtitles. (Urdu voice in the game is fine; the submission text should still have an English explanation.)
- Submit from the Project tab on the team page before Sunday, 15 Nov 2026, 11:59 p.m. local time for your Local Event. The Karachi venue closes at 6:00 PM PKT, so submit before you leave if you can, and do not cut it close.
- Confirm originality and list all external resources in the References field, including open-source or free assets.

Global Nominees are due to be announced on 3 Dec 2026, Global Finalists on 17 Dec 2026, and Global Winners on 26 Jan 2027. Those later rounds use the same five criteria. The ten Global Awards are listed in the guide (Best Use of Science, Best Use of Data, Best Use of Technology, Galactic Impact, Best Mission Concept, Most Inspirational, Best Storytelling, Global Connection, Art & Technology, Local Impact).
